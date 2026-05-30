import { apiClient } from "../client";
import type { RankingType, Rankings, PersonalRank } from "@ouigame/shared/api";

export const rankingsApi = {
  getRankings: (type: RankingType) =>
    apiClient.get<Rankings>(`/rankings/${type}`),
  getMyRank: (type: RankingType) =>
    apiClient.get<PersonalRank>(`/rankings/${type}/me`),
};
