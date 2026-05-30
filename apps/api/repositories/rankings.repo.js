// Pure Drizzle queries for player rankings. No req/res, no business rules:
// the caller supplies the aggregate `selectExpr` (chosen from the ranking type)
// and decides how to interpret the rows.
const { db, schema } = require("@ouigame/db");
const { players, rounds } = schema;
const { eq, sql } = require("drizzle-orm");

// Full leaderboard for the given aggregate, ranked desc and returned in rank order.
async function findRankings(selectExpr) {
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
async function findRankedRows(selectExpr) {
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

async function findUsernameById(playerId) {
  const res = await db
    .select({ username: players.username })
    .from(players)
    .where(eq(players.id, playerId));
  return res.length > 0 ? res[0].username : null;
}

module.exports = {
  findRankings,
  findRankedRows,
  findUsernameById,
};
