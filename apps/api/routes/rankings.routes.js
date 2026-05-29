const express = require("express");
const router = express.Router();
const path = require("path");
const { db, schema } = require(path.join(__dirname, "..", "db"));
const { players, rounds } = schema;
const { eq, sql, sum, count } = require("drizzle-orm");
const { authMiddleware } = require("../middleware/auth.middleware");

function getSelectExpr(type) {
  switch (type) {
    case "KILLS":
      return sum(rounds.kills);
    case "WINS":
      return sum(rounds.wins);
    case "ROUNDS_PLAYED":
      return count(rounds.id);
    default:
      return null;
  }
}

// GET /api/rankings/:type
router.get("/:type", async (req, res) => {
  const { type } = req.params;
  const selectExpr = getSelectExpr(type);

  if (!selectExpr) {
    return res.status(400).json({ error: "Invalid ranking type" });
  }

  try {
    const result = await db
      .select({
        username: players.username,
        total_data: selectExpr,
        rank: sql`RANK() OVER (ORDER BY ${selectExpr} DESC)`,
      })
      .from(players)
      .innerJoin(rounds, eq(players.id, rounds.playerId))
      .groupBy(players.username)
      .orderBy(sql`rank ASC`);

    res.json(result);
  } catch (err) {
    console.error("Error fetching rankings:", err);
    res.status(500).json({ error: "Failed to fetch rankings" });
  }
});

// GET /api/rankings/:type/me
router.get("/:type/me", authMiddleware, async (req, res) => {
  const { type } = req.params;
  const selectExpr = getSelectExpr(type);
  const playerId = req.user.playerId;

  if (!selectExpr) {
    return res.status(400).json({ error: "Invalid ranking type" });
  }

  try {
    const userRes = await db
      .select({ username: players.username })
      .from(players)
      .where(eq(players.id, playerId));
    if (userRes.length === 0) {
      return res.json(null);
    }
    const username = userRes[0].username;

    const result = await db
      .select({
        username: players.username,
        total_data: selectExpr,
        rank: sql`RANK() OVER (ORDER BY ${selectExpr} DESC)`,
      })
      .from(players)
      .innerJoin(rounds, eq(players.id, rounds.playerId))
      .groupBy(players.username);

    const userRank = result.find((r) => r.username === username);
    res.json(userRank || null);
  } catch (err) {
    console.error("Error fetching personal rank:", err);
    res.status(500).json({ error: "Failed to fetch your rank" });
  }
});

module.exports = router;
