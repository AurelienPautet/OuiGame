import { apiClient } from "../client";

export const soloApi = {
  // Submit a solo round
  submitRound: (data) => apiClient.post("/solo/rounds", data),

  // Get stats for a specific level
  getLevelStats: (levelId) => apiClient.get(`/solo/levels/${levelId}/stats`),

  // Get per-level leaderboard
  getLevelLeaderboard: (levelId, limit = 20) =>
    apiClient.get(`/solo/levels/${levelId}/leaderboard?limit=${limit}`),

  // Get global solo leaderboard by type (LEVELS_COMPLETED, LEVELS_PLAYED, KILLS)
  getGlobalLeaderboard: (type, limit = 50) =>
    apiClient.get(`/solo/leaderboard/${type}?limit=${limit}`),

  // Get current user's solo stats
  getMySoloStats: () => apiClient.get("/solo/stats/me"),
};
