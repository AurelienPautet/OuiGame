import { apiClient } from "../client";
import type {
  SubmitSoloRoundRequest,
  SubmitSoloRoundResponse,
  SoloLevelStats,
  SoloLevelLeaderboard,
  SoloGlobalType,
  SoloGlobalLeaderboard,
  MySoloStats,
} from "@ouigame/shared/api";

export const soloApi = {
  // Submit a solo round. The response carries any achievement keys it unlocked.
  submitRound: (data: SubmitSoloRoundRequest) =>
    apiClient.post<SubmitSoloRoundResponse>("/solo/rounds", data),

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
