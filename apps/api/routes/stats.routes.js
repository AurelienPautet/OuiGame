const express = require("express");
const router = express.Router();
const path = require("path");
const { db, schema } = require(path.join(__dirname, "..", "db"));
const { rounds } = schema;
const { eq, sum, count } = require("drizzle-orm");
const { authMiddleware } = require("../middleware/auth.middleware");

// GET /api/stats/me
router.get("/me", authMiddleware, async (req, res) => {
  const playerId = req.user.playerId;

  try {
    const result = await db
      .select({
        kills: sum(rounds.kills),
        deaths: sum(rounds.deaths),
        wins: sum(rounds.wins),
        shots: sum(rounds.shots),
        hits: sum(rounds.hits),
        plants: sum(rounds.plants),
        blocks_destroyed: sum(rounds.blocksDestroyed),
        rounds_played: count(rounds.id),
      })
      .from(rounds)
      .where(eq(rounds.playerId, playerId));

    res.json(result.length > 0 ? result[0] : null);
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
