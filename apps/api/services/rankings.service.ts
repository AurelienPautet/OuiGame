// Orchestration + the ranking-type business rule. Maps a :type to its aggregate
// expression and composes the repo queries; routes only translate the results
// to HTTP. Returns `undefined` for an unknown type so the route can 400.
import { schema } from "@ouigame/db";
const { rounds } = schema;
import { sum, count } from "drizzle-orm";
import * as rankingsRepo from "../repositories/rankings.repo";

function getSelectExpr(type: string) {
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

// Full leaderboard for a ranking type, or undefined when the type is invalid.
async function getRankings(type: string) {
  const selectExpr = getSelectExpr(type);
  if (!selectExpr) return undefined;
  return rankingsRepo.findRankings(selectExpr);
}

// The given player's own rank entry for a ranking type:
//   undefined -> invalid type
//   null      -> unknown player or player not present in the rankings
//   object    -> the player's { username, total_data, rank } row
async function getPlayerRank(type: string, playerId: number) {
  const selectExpr = getSelectExpr(type);
  if (!selectExpr) return undefined;

  const username = await rankingsRepo.findUsernameById(playerId);
  if (username === null) return null;

  const rows = await rankingsRepo.findRankedRows(selectExpr);
  const userRank = rows.find((r) => r.username === username);
  return userRank || null;
}

export { getRankings, getPlayerRank };
