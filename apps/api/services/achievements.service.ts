// Achievements service — evaluates the shared catalog's predicates against the
// stats a player just submitted (plus their lifetime aggregates) and unlocks any
// newly-earned achievements. The unlock itself is idempotent at the repo layer
// (ON CONFLICT DO NOTHING + RETURNING), so this only ever surfaces *new* keys.
//
// All three game modes funnel through here:
//   - online   → evaluateOnlineRound  (called from the tick loop)
//   - solo     → evaluateSolo          (called from the solo submit service)
//   - campaign → evaluateCampaign      (called from the campaigns submit service)
import {
  evaluateOnline,
  evaluateSolo as evaluateSoloRules,
  evaluateCampaign as evaluateCampaignRules,
  isAchievementKey,
  type RoundStats,
  type SoloRoundStats,
  type CampaignRunStats,
} from "@ouigame/shared/api";
import type { UnlockedAchievement } from "@ouigame/shared/api";
import * as repo from "../repositories/achievements.repo";
import * as statsRepo from "../repositories/stats.repo";
import * as soloRepo from "../repositories/solo.repo";

// Evaluate the online-round + cumulative-online achievements. `round` is the
// player's just-recorded round stats; this assumes the round has ALREADY been
// inserted so the aggregate below includes it. Returns newly-unlocked keys.
async function evaluateOnlineRound(
  playerId: number,
  round: RoundStats
): Promise<string[]> {
  const aggRaw = await statsRepo.getUserRoundStats(playerId);
  const agg = {
    kills: Number(aggRaw?.kills) || 0,
    wins: Number(aggRaw?.wins) || 0,
    rounds_played: Number(aggRaw?.rounds_played) || 0,
    blocks_destroyed: Number(aggRaw?.blocks_destroyed) || 0,
  };
  const earned = evaluateOnline(round, agg);
  return repo.insertUnlocks(playerId, earned);
}

// Evaluate the solo achievements. `row` is the just-submitted solo round; the
// lifetime solo aggregate (distinct levels completed) drives `level_master`.
async function evaluateSolo(
  playerId: number,
  row: SoloRoundStats
): Promise<string[]> {
  const aggRaw = await soloRepo.myStats(playerId);
  const agg = { levelsCompleted: Number(aggRaw?.levelsCompleted) || 0 };
  const earned = evaluateSoloRules(row, agg);
  return repo.insertUnlocks(playerId, earned);
}

// Evaluate the campaign achievements against the just-submitted run.
async function evaluateCampaign(
  playerId: number,
  run: CampaignRunStats
): Promise<string[]> {
  const earned = evaluateCampaignRules(run);
  return repo.insertUnlocks(playerId, earned);
}

// The player's unlocked achievements for GET /achievements/me. Stale keys (an
// achievement retired from the catalog) are dropped so the client never has to
// render an unknown key. `unlockedAt` is serialized as an ISO string.
async function getMyAchievements(
  playerId: number
): Promise<UnlockedAchievement[]> {
  const rows = await repo.getUnlockedRows(playerId);
  return rows
    .filter((r) => isAchievementKey(r.key))
    .map((r) => ({
      key: r.key,
      unlockedAt: (r.unlockedAt ?? new Date(0)).toISOString(),
    }));
}

export {
  evaluateOnlineRound,
  evaluateSolo,
  evaluateCampaign,
  getMyAchievements,
};
