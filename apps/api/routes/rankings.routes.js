const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const rankingsService = require("../services/rankings.service");

// GET /api/rankings/:type
router.get("/:type", async (req, res) => {
  const { type } = req.params;

  try {
    const result = await rankingsService.getRankings(type);
    if (result === undefined) {
      return res.status(400).json({ error: "Invalid ranking type" });
    }
    res.json(result);
  } catch (err) {
    console.error("Error fetching rankings:", err);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

// GET /api/rankings/:type/me
router.get("/:type/me", authMiddleware, async (req, res) => {
  const { type } = req.params;
  const playerId = req.user.playerId;

  try {
    const userRank = await rankingsService.getPlayerRank(type, playerId);
    if (userRank === undefined) {
      return res.status(400).json({ error: "Invalid ranking type" });
    }
    res.json(userRank);
  } catch (err) {
    console.error("Error fetching personal rank:", err);
    res.status(500).json({ error: "Failed to fetch your rank" });
  }
});

module.exports = router;
