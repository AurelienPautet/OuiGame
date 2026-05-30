const express = require("express");
const router = express.Router();
const { db, schema } = require("@ouigame/db");
const { campaigns, campaignLevels, campaignRuns, levels, levelsImg, players } =
  schema;
const {
  eq,
  like,
  and,
  sql,
  count,
  asc,
  desc,
  inArray,
} = require("drizzle-orm");
const {
  authMiddleware,
  optionalAuth,
} = require("../middleware/auth.middleware");

// Parse a positive-integer path/query param, or null if it isn't one.
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// --- Batched lookups (avoid N+1 over a list) ---

async function getCreatorNames(creatorIds) {
  const ids = [...new Set(creatorIds.filter((id) => id != null))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: players.id, username: players.username })
    .from(players)
    .where(inArray(players.id, ids));
  return new Map(rows.map((r) => [r.id, r.username]));
}

async function getImagesByLevelId(levelIds) {
  if (levelIds.length === 0) return new Map();
  const rows = await db
    .select({ levelId: levelsImg.levelId, img: levelsImg.img })
    .from(levelsImg)
    .where(inArray(levelsImg.levelId, levelIds));
  return new Map(
    rows.map((r) => [r.levelId, r.img ? r.img.toString("hex") : null])
  );
}

// Number of still-playable (status 'up') levels per campaign. Used as the
// completion denominator so a campaign stays reachable at 100% even if some
// of its levels are later taken down.
async function getLevelCounts(campaignIds) {
  if (campaignIds.length === 0) return new Map();
  const rows = await db
    .select({ campaignId: campaignLevels.campaignId, cnt: count(levels.id) })
    .from(campaignLevels)
    .innerJoin(levels, eq(campaignLevels.levelId, levels.id))
    .where(
      and(
        inArray(campaignLevels.campaignId, campaignIds),
        eq(levels.status, "up")
      )
    )
    .groupBy(campaignLevels.campaignId);
  return new Map(rows.map((r) => [r.campaignId, Number(r.cnt) || 0]));
}

// This player's best progress per campaign: furthest run + whether any run
// was completed. Skipped entirely for anonymous requests.
async function getCompletionByCampaign(campaignIds, playerId) {
  if (!playerId || campaignIds.length === 0) return new Map();
  const rows = await db
    .select({
      campaignId: campaignRuns.campaignId,
      maxCleared: sql`MAX(${campaignRuns.levelsCleared})`,
      anyCompleted: sql`BOOL_OR(${campaignRuns.completed})`,
    })
    .from(campaignRuns)
    .where(
      and(
        eq(campaignRuns.playerId, playerId),
        inArray(campaignRuns.campaignId, campaignIds)
      )
    )
    .groupBy(campaignRuns.campaignId);
  return new Map(
    rows.map((r) => [
      r.campaignId,
      { maxCleared: Number(r.maxCleared) || 0, anyCompleted: !!r.anyCompleted },
    ])
  );
}

async function formatCampaigns(rows, playerId) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [creators, counts, completion] = await Promise.all([
    getCreatorNames(rows.map((r) => r.creatorId)),
    getLevelCounts(ids),
    getCompletionByCampaign(ids, playerId),
  ]);

  return rows.map((row) => {
    const levelCount = counts.get(row.id) || 0;
    const comp = completion.get(row.id);
    const maxCleared = comp?.maxCleared || 0;
    return {
      campaign_id: row.id,
      campaign_name: row.name,
      campaign_description: row.description,
      campaign_creator_name: creators.get(row.creatorId) || "Unknown",
      level_count: levelCount,
      completion_percent:
        levelCount > 0
          ? Math.min(100, Math.round((maxCleared / levelCount) * 100))
          : 0,
      completed: comp?.anyCompleted || false,
    };
  });
}

// Ordered, still-playable levels of a campaign (for the run loop + editor).
async function getCampaignLevels(campaignId) {
  const rows = await db
    .select({
      levelId: levels.id,
      name: levels.name,
      creatorId: levels.creatorId,
      orderIndex: campaignLevels.orderIndex,
    })
    .from(campaignLevels)
    .innerJoin(levels, eq(campaignLevels.levelId, levels.id))
    .where(
      and(eq(campaignLevels.campaignId, campaignId), eq(levels.status, "up"))
    )
    .orderBy(asc(campaignLevels.orderIndex));
  if (rows.length === 0) return [];

  const [creators, images] = await Promise.all([
    getCreatorNames(rows.map((r) => r.creatorId)),
    getImagesByLevelId(rows.map((r) => r.levelId)),
  ]);
  return rows.map((r) => ({
    level_id: r.levelId,
    level_name: r.name,
    level_creator_name: creators.get(r.creatorId) || "Unknown",
    level_img: images.get(r.levelId) ?? null,
    order_index: r.orderIndex,
  }));
}

// Keep only ids that are real, public (status 'up') solo levels, preserving the
// caller's order and dropping duplicates. Campaigns are played vs bots, so only
// solo levels are eligible.
async function filterSoloLevelIds(levelIds) {
  if (!Array.isArray(levelIds)) return [];
  const candidates = levelIds.filter((id) => Number.isInteger(id) && id > 0);
  if (candidates.length === 0) return [];
  const rows = await db
    .select({ id: levels.id })
    .from(levels)
    .where(
      and(
        inArray(levels.id, [...new Set(candidates)]),
        eq(levels.type, "solo"),
        eq(levels.status, "up")
      )
    );
  const valid = new Set(rows.map((r) => r.id));
  const seen = new Set();
  const out = [];
  for (const id of levelIds) {
    if (valid.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function isUniqueViolation(err) {
  return err && (err.code === "23505" || err.cause?.code === "23505");
}

async function insertCampaignLevels(campaignId, orderedLevelIds) {
  if (orderedLevelIds.length === 0) return;
  await db.insert(campaignLevels).values(
    orderedLevelIds.map((levelId, index) => ({
      campaignId,
      levelId,
      orderIndex: index,
    }))
  );
}

// GET /api/campaigns?name=
router.get("/", optionalAuth, async (req, res) => {
  const { name = "" } = req.query;
  const playerId = req.user?.playerId ?? null;
  try {
    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        creatorId: campaigns.creatorId,
      })
      .from(campaigns)
      .where(like(campaigns.name, sql`'%' || ${name} || '%'`))
      .orderBy(desc(campaigns.creationTimestamp));

    res.json(await formatCampaigns(rows, playerId));
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// GET /api/campaigns/my?name=
router.get("/my", authMiddleware, async (req, res) => {
  const { name = "" } = req.query;
  const playerId = req.user.playerId;
  try {
    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        creatorId: campaigns.creatorId,
      })
      .from(campaigns)
      .where(
        and(
          like(campaigns.name, sql`'%' || ${name} || '%'`),
          eq(campaigns.creatorId, playerId)
        )
      )
      .orderBy(desc(campaigns.creationTimestamp));

    res.json(await formatCampaigns(rows, playerId));
  } catch (err) {
    console.error("Error fetching my campaigns:", err);
    res.status(500).json({ error: "Failed to fetch your campaigns" });
  }
});

// GET /api/campaigns/:id  (campaign meta + ordered levels + this user's progress)
router.get("/:id", optionalAuth, async (req, res) => {
  const campaignId = parseId(req.params.id);
  if (campaignId === null) {
    return res.status(400).json({ error: "Invalid campaign id" });
  }
  const playerId = req.user?.playerId ?? null;
  try {
    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        creatorId: campaigns.creatorId,
      })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
    if (rows.length === 0) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const [formatted] = await formatCampaigns(rows, playerId);
    const campaignLevelsList = await getCampaignLevels(campaignId);
    res.json({ ...formatted, levels: campaignLevelsList });
  } catch (err) {
    console.error("Error fetching campaign:", err);
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
});

// POST /api/campaigns  { name, description, levelIds: [] }
router.post("/", authMiddleware, async (req, res) => {
  const { name, levelIds } = req.body;
  // Coerce to a string: the destructuring default only covers `undefined`, so a
  // null/number `description` would otherwise skip validation and hit the
  // NOT NULL column at insert time (500).
  const description =
    typeof req.body.description === "string" ? req.body.description : "";
  const playerId = req.user.playerId;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Campaign name is required" });
  }
  if (name.length > 30) {
    return res.status(400).json({ error: "Campaign name too long (max 30)" });
  }
  if (description.length > 300) {
    return res
      .status(400)
      .json({ error: "Campaign description too long (max 300)" });
  }

  try {
    const ordered = await filterSoloLevelIds(levelIds);
    if (ordered.length < 1) {
      return res
        .status(400)
        .json({ error: "Campaign must contain at least one solo level" });
    }

    const inserted = await db
      .insert(campaigns)
      .values({ name: name.trim(), description, creatorId: playerId })
      .returning({ id: campaigns.id });
    const campaignId = inserted[0].id;

    await insertCampaignLevels(campaignId, ordered);
    res.json({ campaignId });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "Campaign name already taken" });
    }
    console.error("Error creating campaign:", err);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// PUT /api/campaigns/:id  { name, description, levelIds: [] }
router.put("/:id", authMiddleware, async (req, res) => {
  const campaignId = parseId(req.params.id);
  if (campaignId === null) {
    return res.status(400).json({ error: "Invalid campaign id" });
  }
  const { name, levelIds } = req.body;
  const description =
    typeof req.body.description === "string" ? req.body.description : "";
  const playerId = req.user.playerId;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Campaign name is required" });
  }
  if (name.length > 30) {
    return res.status(400).json({ error: "Campaign name too long (max 30)" });
  }
  if (description.length > 300) {
    return res
      .status(400)
      .json({ error: "Campaign description too long (max 300)" });
  }

  try {
    const existing = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(eq(campaigns.id, campaignId), eq(campaigns.creatorId, playerId))
      );
    if (existing.length === 0) {
      return res.status(403).json({ error: "Not your campaign" });
    }

    const ordered = await filterSoloLevelIds(levelIds);
    if (ordered.length < 1) {
      return res
        .status(400)
        .json({ error: "Campaign must contain at least one solo level" });
    }

    await db
      .update(campaigns)
      .set({ name: name.trim(), description })
      .where(eq(campaigns.id, campaignId));

    // Rewrite the level set wholesale so add/remove/reorder always produce a
    // clean, gap-free 0..n-1 order_index sequence.
    await db
      .delete(campaignLevels)
      .where(eq(campaignLevels.campaignId, campaignId));
    await insertCampaignLevels(campaignId, ordered);

    res.json({ campaignId });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ error: "Campaign name already taken" });
    }
    console.error("Error updating campaign:", err);
    res.status(500).json({ error: "Failed to update campaign" });
  }
});

// DELETE /api/campaigns/:id
router.delete("/:id", authMiddleware, async (req, res) => {
  const campaignId = parseId(req.params.id);
  if (campaignId === null) {
    return res.status(400).json({ error: "Invalid campaign id" });
  }
  const playerId = req.user.playerId;

  try {
    const existing = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(
        and(eq(campaigns.id, campaignId), eq(campaigns.creatorId, playerId))
      );
    if (existing.length === 0) {
      return res.status(403).json({ error: "Not your campaign" });
    }

    // Manual cascade (no ON DELETE CASCADE in the schema).
    await db
      .delete(campaignRuns)
      .where(eq(campaignRuns.campaignId, campaignId));
    await db
      .delete(campaignLevels)
      .where(eq(campaignLevels.campaignId, campaignId));
    await db.delete(campaigns).where(eq(campaigns.id, campaignId));

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting campaign:", err);
    res.status(500).json({ error: "Failed to delete campaign" });
  }
});

// POST /api/campaigns/:id/runs  { levelsCleared, livesLeft, completed, timeMs }
// optionalAuth: anonymous runs are accepted (player_id null) but only matter
// for logged-in players. Mirrors POST /api/solo/rounds.
router.post("/:id/runs", optionalAuth, async (req, res) => {
  const campaignId = parseId(req.params.id);
  if (campaignId === null) {
    return res.status(400).json({ error: "Invalid campaign id" });
  }
  const { levelsCleared, livesLeft, completed, timeMs } = req.body;
  // Validate types/ranges explicitly rather than coercing, so bad input (e.g.
  // completed: "false", negative counts) can't be silently recorded as truthy.
  const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;
  if (
    !isNonNegInt(levelsCleared) ||
    typeof completed !== "boolean" ||
    !isNonNegInt(timeMs) ||
    (livesLeft !== undefined && !isNonNegInt(livesLeft))
  ) {
    return res.status(400).json({ error: "Invalid or missing run fields" });
  }

  try {
    const exists = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));
    if (exists.length === 0) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const playerId = req.user?.playerId || null;
    await db.insert(campaignRuns).values({
      playerId,
      campaignId,
      levelsCleared,
      livesLeft: livesLeft ?? 0,
      completed,
      timeMs,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error submitting campaign run:", err);
    res.status(500).json({ error: "Failed to submit campaign run" });
  }
});

module.exports = router;
