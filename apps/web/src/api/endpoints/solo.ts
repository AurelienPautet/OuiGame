import { apiClient } from "../client";
import type {
  SubmitSoloRoundRequest,
  SoloLevelStats,
  SoloLevelLeaderboard,
  SoloGlobalType,
  SoloGlobalLeaderboard,
  MySoloStats,
  SuccessResponse,
} from "@ouigame/shared/api";

export const soloApi = {
  // Submit a solo round
  submitRound: (data: SubmitSoloRoundRequest) =>
    apiClient.post<SuccessResponse>("/solo/rounds", data),

  // Get stats for a specific level
  getLevelStats: (levelId: number | string) =>
    apiClient.get<SoloLevelStats>(`/solo/levels/${levelId}/stats`),

  // Get per-level leaderboard
  getLevelLeaderboard: (levelId: number | string, limit = 20) =>
    apiClient.get<SoloLevelLeaderboard>(
      `/solo/levels/${levelId}/leaderboard?limit=${limit}`
    ),

  // Get global solo leaderboard by type (LEVELS_COMPLETED, LEVELS_PLAYED, KILLS)
  getGlobalLeaderboard: (type: SoloGlobalType, limit = 50) =>
    apiClient.get<SoloGlobalLeaderboard>(
      `/solo/leaderboard/${type}?limit=${limit}`
    ),

  // Get current user's solo stats
  getMySoloStats: () => apiClient.get<MySoloStats>("/solo/stats/me"),
};
