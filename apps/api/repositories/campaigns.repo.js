// Campaigns data access — PURE Drizzle queries (no req/res, no socket, no
// business rules). Returns raw rows / maps; shaping + ownership live in the
// service. Extracted verbatim from the old inline route helpers so the wire
// shapes are byte-for-byte unchanged.
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

// A player's best progress per campaign: furthest run + whether any run was
// completed (MAX(levels_cleared) / BOOL_OR(completed)).
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

// --- Campaign rows ---

// Campaigns whose name matches `name`, newest first.
async function listCampaigns(name) {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      description: campaigns.description,
      creatorId: campaigns.creatorId,
    })
    .from(campaigns)
    .where(like(campaigns.name, sql`'%' || ${name} || '%'`))
    .orderBy(desc(campaigns.creationTimestamp));
}

// Same as listCampaigns but restricted to a single creator.
async function listCampaignsByCreator(name, creatorId) {
  return db
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
        eq(campaigns.creatorId, creatorId)
      )
    )
    .orderBy(desc(campaigns.creationTimestamp));
}

// A single campaign meta row by id (array, empty if not found).
async function getCampaignById(campaignId) {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      description: campaigns.description,
      creatorId: campaigns.creatorId,
    })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
}

// Existence/ownership probe: campaign with this id owned by this creator.
async function getOwnedCampaign(campaignId, creatorId) {
  return db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(eq(campaigns.id, campaignId), eq(campaigns.creatorId, creatorId))
    );
}

// Existence probe (any owner).
async function campaignExists(campaignId) {
  return db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
}

async function insertCampaign({ name, description, creatorId }) {
  const inserted = await db
    .insert(campaigns)
    .values({ name, description, creatorId })
    .returning({ id: campaigns.id });
  return inserted[0].id;
}

async function updateCampaign(campaignId, { name, description }) {
  await db
    .update(campaigns)
    .set({ name, description })
    .where(eq(campaigns.id, campaignId));
}

// Single-row campaigns delete. Runs (via campaign_id) and campaign-level links
// are removed by ON DELETE CASCADE in the schema.
async function deleteCampaign(campaignId) {
  await db.delete(campaigns).where(eq(campaigns.id, campaignId));
}

// --- Campaign levels ---

// Ordered, still-playable level rows of a campaign (for the run loop + editor).
async function getCampaignLevels(campaignId) {
  return db
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
}

// Of the given ids, the ones that are real, public (status 'up') solo levels.
async function getValidSoloLevelIds(candidateIds) {
  if (candidateIds.length === 0) return [];
  const rows = await db
    .select({ id: levels.id })
    .from(levels)
    .where(
      and(
        inArray(levels.id, candidateIds),
        eq(levels.type, "solo"),
        eq(levels.status, "up")
      )
    );
  return rows.map((r) => r.id);
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

// Rewrite the level set wholesale so add/remove/reorder always produce a clean,
// gap-free 0..n-1 order_index sequence. NOT a parent-delete cascade.
async function replaceCampaignLevels(campaignId, orderedLevelIds) {
  await db
    .delete(campaignLevels)
    .where(eq(campaignLevels.campaignId, campaignId));
  await insertCampaignLevels(campaignId, orderedLevelIds);
}

// --- Campaign runs ---

async function insertCampaignRun(run) {
  await db.insert(campaignRuns).values(run);
}

module.exports = {
  getCreatorNames,
  getImagesByLevelId,
  getLevelCounts,
  getCompletionByCampaign,
  listCampaigns,
  listCampaignsByCreator,
  getCampaignById,
  getOwnedCampaign,
  campaignExists,
  insertCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignLevels,
  getValidSoloLevelIds,
  insertCampaignLevels,
  replaceCampaignLevels,
  insertCampaignRun,
};
