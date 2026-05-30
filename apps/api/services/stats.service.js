// Stats service — orchestration over the stats repository.
const statsRepo = require("../repositories/stats.repo");

// Aggregate stats for the authenticated player (null if no rounds).
async function getMyStats(playerId) {
  return statsRepo.getUserRoundStats(playerId);
}

module.exports = {
  getMyStats,
};
