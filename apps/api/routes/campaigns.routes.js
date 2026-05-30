const express = require("express");
const router = express.Router();
const { parseId } = require("../repositories/shared/format");
const service = require("../services/campaigns.service");
const {
  authMiddleware,
  optionalAuth,
} = require("../middleware/auth.middleware");

function isUniqueViolation(err) {
  return err && (err.code === "23505" || err.cause?.code === "23505");
}

// GET /api/campaigns?name=
router.get("/", optionalAuth, async (req, res) => {
  const { name = "" } = req.query;
  const playerId = req.user?.playerId ?? null;
  try {
    res.json(await service.listCampaigns(name, playerId));
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
    res.json(await service.listMyCampaigns(name, playerId));
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
    res.json(await service.getCampaignDetail(campaignId, playerId));
  } catch (err) {
    if (err.isServiceError) {
      return res.status(err.status).json({ error: err.message });
    }
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
    const result = await service.createCampaign({
      name,
      description,
      creatorId: playerId,
      levelIds,
    });
    res.json(result);
  } catch (err) {
    if (err.isServiceError) {
      return res.status(err.status).json({ error: err.message });
    }
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
    const result = await service.updateCampaign({
      campaignId,
      name,
      description,
      playerId,
      levelIds,
    });
    res.json(result);
  } catch (err) {
    if (err.isServiceError) {
      return res.status(err.status).json({ error: err.message });
    }
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
    const result = await service.deleteCampaign(campaignId, playerId);
    res.json(result);
  } catch (err) {
    if (err.isServiceError) {
      return res.status(err.status).json({ error: err.message });
    }
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
    const playerId = req.user?.playerId || null;
    const result = await service.submitRun({
      campaignId,
      playerId,
      levelsCleared,
      livesLeft,
      completed,
      timeMs,
    });
    res.json(result);
  } catch (err) {
    if (err.isServiceError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error submitting campaign run:", err);
    res.status(500).json({ error: "Failed to submit campaign run" });
  }
});

module.exports = router;
