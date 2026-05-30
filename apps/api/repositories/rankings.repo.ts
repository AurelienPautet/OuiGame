// Pure Drizzle queries for player rankings. No req/res, no business rules:
// the caller supplies the aggregate `selectExpr` (chosen from the ranking type)
// and decides how to interpret the rows.
import { db, schema } from "@ouigame/db";
import { eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

const { players, rounds } = schema;

// Full leaderboard for the given aggregate, ranked desc and returned in rank order.
async function findRankings(selectExpr: SQL) {
  return db
    .select({
      username: players.username,
      total_data: selectExpr,
      rank: sql`RANK() OVER (ORDER BY ${selectExpr} DESC)`,
    })
    .from(players)
    .innerJoin(rounds, eq(players.id, rounds.playerId))
    .groupBy(players.username)
    .orderBy(sql`rank ASC`);
}

// Same aggregate + ranking, but unordered — the caller picks out a single row.
async function findRankedRows(selectExpr: SQL) {
  return db
    .select({
      username: players.username,
      total_data: selectExpr,
      rank: sql`RANK() OVER (ORDER BY ${selectExpr} DESC)`,
    })
    .from(players)
    .innerJoin(rounds, eq(players.id, rounds.playerId))
    .groupBy(players.username);
}

async function findUsernameById(playerId: number) {
  const res = await db
    .select({ username: players.username })
    .from(players)
    .where(eq(players.id, playerId));
  return res.length > 0 ? res[0].username : null;
}

export { findRankings, findRankedRows, findUsernameById };
