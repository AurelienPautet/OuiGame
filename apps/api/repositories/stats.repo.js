// Stats repository — pure Drizzle queries over the rounds table. No req/res,
// no socket, no business rules.
const { db, schema } = require("@ouigame/db");
const { rounds } = schema;
const { eq, sum, count } = require("drizzle-orm");

// Aggregate the given player's round history, or null if they have none.
async function getUserRoundStats(playerId) {
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

  return result.length > 0 ? result[0] : null;
}

// Insert one round. statsObj uses the wire field `blocks_destroyed`, mapped to
// the schema column `blocksDestroyed`. Replaces the dead db_stats.add_round.
async function insertRound(playerId, levelId, statsObj) {
  await db.insert(rounds).values({
    playerId,
    levelId,
    kills: statsObj.kills,
    deaths: statsObj.deaths,
    wins: statsObj.wins,
    shots: statsObj.shots,
    hits: statsObj.hits,
    plants: statsObj.plants,
    blocksDestroyed: statsObj.blocks_destroyed,
  });
}

module.exports = {
  getUserRoundStats,
  insertRound,
};
