// Stats service — orchestration over the stats repository.
import * as statsRepo from "../repositories/stats.repo";

// Aggregate stats for the authenticated player (null if no rounds).
async function getMyStats(playerId: number) {
  return statsRepo.getUserRoundStats(playerId);
}

export { getMyStats };
