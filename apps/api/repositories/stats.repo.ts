// Stats repository — pure Drizzle queries over the rounds table. No req/res,
// no socket, no business rules.
import { db, schema } from "@ouigame/db";
import { eq, sum, count } from "drizzle-orm";

const { rounds } = schema;

// Aggregate the given player's round history, or null if they have none.
async function getUserRoundStats(playerId: number) {
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
async function insertRound(
  playerId: number | null,
  levelId: number,
  statsObj: {
    kills: number;
    deaths: number;
    wins: number;
    shots: number;
    hits: number;
    plants: number;
    blocks_destroyed: number;
  }
) {
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

export { getUserRoundStats, insertRound };
