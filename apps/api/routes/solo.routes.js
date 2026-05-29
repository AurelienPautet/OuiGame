const express = require("express");
const router = express.Router();
const path = require("path");
const { db, schema } = require(path.join(__dirname, "..", "db"));
const { soloRounds, players, levels } = schema;
const { eq, sql, sum, count, desc, and, isNotNull } = require("drizzle-orm");
const {
  authMiddleware,
  optionalAuth,
} = require("../middleware/auth.middleware");

// POST /api/solo/rounds - Submit a solo round
// Uses optional auth - logged in players get their ID attached, anonymous still tracked
router.post("/rounds", optionalAuth, async (req, res) => {
  const {
    levelId,
    success,
    timeMs,
    kills,
    deaths,
    shots,
    hits,
    plants,
    blocksDestroyed,
  } = req.body;

  // Validate required fields
  if (levelId === undefined || success === undefined || timeMs === undefined) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // playerId is null for anonymous players
    const playerId = req.user?.playerId || null;

    await db.insert(soloRounds).values({
      playerId,
      levelId,
      success,
      timeMs,
      kills: kills || 0,
      deaths: deaths || 0,
      shots: shots || 0,
      hits: hits || 0,
      plants: plants || 0,
      blocksDestroyed: blocksDestroyed || 0,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Error submitting solo round:", err);
    res.status(500).json({ error: "Failed to submit round" });
  }
});

// GET /api/solo/levels/:id/stats - Get stats for a specific level
router.get("/levels/:id/stats", async (req, res) => {
  const levelId = parseInt(req.params.id);

  try {
    const result = await db
      .select({
        timesPlayed: count(soloRounds.id),
        totalWins: sum(sql`CASE WHEN ${soloRounds.success} THEN 1 ELSE 0 END`),
        bestTimeMs: sql`MIN(CASE WHEN ${soloRounds.success} THEN ${soloRounds.timeMs} END)`,
        avgTimeMs: sql`AVG(CASE WHEN ${soloRounds.success} THEN ${soloRounds.timeMs} END)`,
      })
      .from(soloRounds)
      .where(eq(soloRounds.levelId, levelId));

    const stats = result[0];
    const timesPlayed = Number(stats.timesPlayed) || 0;
    const totalWins = Number(stats.totalWins) || 0;
    const successRate =
      timesPlayed > 0 ? Math.round((totalWins / timesPlayed) * 100) : 0;

    res.json({
      timesPlayed,
      successRate,
      bestTimeMs: stats.bestTimeMs ? Number(stats.bestTimeMs) : null,
      avgTimeMs: stats.avgTimeMs ? Math.round(Number(stats.avgTimeMs)) : null,
    });
  } catch (err) {
    console.error("Error fetching level stats:", err);
    res.status(500).json({ error: "Failed to fetch level stats" });
  }
});

// GET /api/solo/levels/:id/leaderboard - Per-level leaderboard (best times)
// Includes anonymous players
router.get("/levels/:id/leaderboard", async (req, res) => {
  const levelId = parseInt(req.params.id);
  const limit = parseInt(req.query.limit) || 20;

  try {
    // Get best time per player (including anonymous as "Anonymous")
    const result = await db
      .select({
        username: sql`COALESCE(${players.username}, 'Anonymous')`,
        timeMs: sql`MIN(${soloRounds.timeMs})`,
        playerId: soloRounds.playerId,
      })
      .from(soloRounds)
      .leftJoin(players, eq(soloRounds.playerId, players.id))
      .where(and(eq(soloRounds.levelId, levelId), eq(soloRounds.success, true)))
      .groupBy(soloRounds.playerId, players.username)
      .orderBy(sql`MIN(${soloRounds.timeMs}) ASC`)
      .limit(limit);

    // Add rank numbers
    const leaderboard = result.map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      timeMs: Number(entry.timeMs),
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching level leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET /api/solo/leaderboard/:type - Global solo leaderboard by type
// Only logged-in players (excludes anonymous)
// Types: LEVELS_COMPLETED, LEVELS_PLAYED, KILLS
router.get("/leaderboard/:type", async (req, res) => {
  const { type } = req.params;
  const limit = parseInt(req.query.limit) || 50;

  // Determine sort expression based on type
  let sortExpr;
  let selectField;
  switch (type) {
    case "LEVELS_COMPLETED":
      sortExpr = sql`COUNT(DISTINCT CASE WHEN ${soloRounds.success} THEN ${soloRounds.levelId} END)`;
      selectField = "levelsCompleted";
      break;
    case "LEVELS_PLAYED":
      sortExpr = count(soloRounds.id);
      selectField = "levelsPlayed";
      break;
    case "KILLS":
      sortExpr = sum(soloRounds.kills);
      selectField = "kills";
      break;
    default:
      return res.status(400).json({ error: "Invalid ranking type" });
  }

  try {
    const result = await db
      .select({
        username: players.username,
        total_data: sortExpr,
      })
      .from(soloRounds)
      .innerJoin(players, eq(soloRounds.playerId, players.id))
      .where(isNotNull(soloRounds.playerId))
      .groupBy(players.id, players.username)
      .orderBy(desc(sortExpr))
      .limit(limit);

    const leaderboard = result.map((entry, index) => ({
      rank: index + 1,
      username: entry.username,
      total_data: Number(entry.total_data) || 0,
    }));

    res.json(leaderboard);
  } catch (err) {
    console.error("Error fetching global solo leaderboard:", err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET /api/solo/stats/me - Current user's solo stats
router.get("/stats/me", authMiddleware, async (req, res) => {
  const playerId = req.user.playerId;

  try {
    const result = await db
      .select({
        levelsCompleted: sql`COUNT(DISTINCT CASE WHEN ${soloRounds.success} THEN ${soloRounds.levelId} END)`,
        totalRounds: count(soloRounds.id),
        totalWins: sum(sql`CASE WHEN ${soloRounds.success} THEN 1 ELSE 0 END`),
        totalKills: sum(soloRounds.kills),
        totalDeaths: sum(soloRounds.deaths),
        totalShots: sum(soloRounds.shots),
        totalHits: sum(soloRounds.hits),
      })
      .from(soloRounds)
      .where(eq(soloRounds.playerId, playerId));

    const stats = result[0];
    const totalRounds = Number(stats.totalRounds) || 0;
    const totalWins = Number(stats.totalWins) || 0;
    const totalShots = Number(stats.totalShots) || 0;
    const totalHits = Number(stats.totalHits) || 0;

    res.json({
      levelsCompleted: Number(stats.levelsCompleted) || 0,
      totalRounds,
      totalWins,
      winRate:
        totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0,
      totalKills: Number(stats.totalKills) || 0,
      totalDeaths: Number(stats.totalDeaths) || 0,
      avgAccuracy:
        totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : 0,
    });
  } catch (err) {
    console.error("Error fetching my solo stats:", err);
    res.status(500).json({ error: "Failed to fetch your solo stats" });
  }
});

module.exports = router;
