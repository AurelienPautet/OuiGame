// Solo domain service: orchestration + business rules. Validates inputs,
// builds leaderboard sort expressions, coerces aggregate rows to numbers and
// computes derived rates/ranks, then returns plain wire objects for the route.
import { sql, sum, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { schema } from "@ouigame/db";
const { soloRounds } = schema;
import * as repo from "../repositories/solo.repo";

interface SoloRoundBody {
  levelId?: number;
  success?: boolean;
  timeMs?: number;
  kills?: number;
  deaths?: number;
  shots?: number;
  hits?: number;
  plants?: number;
  blocksDestroyed?: number;
}

// Submit a solo round. playerId is null for anonymous players. Returns true if
// the body has the required fields and the round was recorded, false otherwise
// (the route maps a false result to the 400 "Missing required fields").
async function submitRound(playerId: number | null, body: SoloRoundBody) {
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
  } = body;

  if (levelId === undefined || success === undefined || timeMs === undefined) {
    return false;
  }

  await repo.insertRound({
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

  return true;
}

async function getLevelStats(levelId: number) {
  const stats = await repo.levelStats(levelId);
  const timesPlayed = Number(stats.timesPlayed) || 0;
  const totalWins = Number(stats.totalWins) || 0;
  const successRate =
    timesPlayed > 0 ? Math.round((totalWins / timesPlayed) * 100) : 0;

  return {
    timesPlayed,
    successRate,
    bestTimeMs: stats.bestTimeMs ? Number(stats.bestTimeMs) : null,
    avgTimeMs: stats.avgTimeMs ? Math.round(Number(stats.avgTimeMs)) : null,
  };
}

async function getLevelLeaderboard(levelId: number, limit: number) {
  const result = await repo.levelLeaderboard(levelId, limit);
  return result.map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    timeMs: Number(entry.timeMs),
  }));
}

// Returns null for an unknown ranking type so the route can map it to a 400.
async function getGlobalLeaderboard(type: string, limit: number) {
  let sortExpr: SQL;
  switch (type) {
    case "LEVELS_COMPLETED":
      sortExpr = sql`COUNT(DISTINCT CASE WHEN ${soloRounds.success} THEN ${soloRounds.levelId} END)`;
      break;
    case "LEVELS_PLAYED":
      sortExpr = count(soloRounds.id);
      break;
    case "KILLS":
      sortExpr = sum(soloRounds.kills);
      break;
    default:
      return null;
  }

  const result = await repo.globalLeaderboard(sortExpr, limit);
  return result.map((entry, index) => ({
    rank: index + 1,
    username: entry.username,
    total_data: Number(entry.total_data) || 0,
  }));
}

async function getMyStats(playerId: number) {
  const stats = await repo.myStats(playerId);
  const totalRounds = Number(stats.totalRounds) || 0;
  const totalWins = Number(stats.totalWins) || 0;
  const totalShots = Number(stats.totalShots) || 0;
  const totalHits = Number(stats.totalHits) || 0;

  return {
    levelsCompleted: Number(stats.levelsCompleted) || 0,
    totalRounds,
    totalWins,
    winRate: totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0,
    totalKills: Number(stats.totalKills) || 0,
    totalDeaths: Number(stats.totalDeaths) || 0,
    avgAccuracy:
      totalShots > 0 ? Math.round((totalHits / totalShots) * 100) : 0,
  };
}

export {
  submitRound,
  getLevelStats,
  getLevelLeaderboard,
  getGlobalLeaderboard,
  getMyStats,
};
