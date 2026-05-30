const express = require("express");
const router = express.Router();
const statsService = require("../services/stats.service");
const { authMiddleware } = require("../middleware/auth.middleware");

// GET /api/stats/me
router.get("/me", authMiddleware, async (req, res) => {
  const playerId = req.user.playerId;

  try {
    const stats = await statsService.getMyStats(playerId);
    res.json(stats);
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
