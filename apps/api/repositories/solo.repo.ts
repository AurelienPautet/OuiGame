// Solo domain repository: PURE Drizzle queries for solo rounds, per-level
// stats/leaderboards, the global leaderboard, and the current user's stats.
// No req/res, no business rules — callers (the service) coerce/format the rows.
import { db, schema } from "@ouigame/db";
import { eq, sql, sum, count, desc, and, isNotNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

const { soloRounds, players } = schema;

// Insert a single solo round. `values` is already normalized by the service.
async function insertRound(values: typeof soloRounds.$inferInsert) {
  await db.insert(soloRounds).values(values);
}

// Aggregate stats for one level (play count, wins, best/avg successful time).
async function levelStats(levelId: number) {
  const result = await db
    .select({
      timesPlayed: count(soloRounds.id),
      totalWins: sum(sql`CASE WHEN ${soloRounds.success} THEN 1 ELSE 0 END`),
      bestTimeMs: sql`MIN(CASE WHEN ${soloRounds.success} THEN ${soloRounds.timeMs} END)`,
      avgTimeMs: sql`AVG(CASE WHEN ${soloRounds.success} THEN ${soloRounds.timeMs} END)`,
    })
    .from(soloRounds)
    .where(eq(soloRounds.levelId, levelId));
  return result[0];
}

// Best successful time per player for a level (anonymous as null username),
// ordered fastest-first.
async function levelLeaderboard(levelId: number, limit: number) {
  return db
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
}

// Global leaderboard over logged-in players, ranked by the given sort
// expression (built by the service from the requested type).
async function globalLeaderboard(sortExpr: SQL, limit: number) {
  return db
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
}

// Lifetime solo stats for a single player.
async function myStats(playerId: number) {
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
  return result[0];
}

export {
  insertRound,
  levelStats,
  levelLeaderboard,
  globalLeaderboard,
  myStats,
};
