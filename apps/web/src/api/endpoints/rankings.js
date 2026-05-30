import { apiClient } from "../client";

export const rankingsApi = {
  getRankings: (type) => apiClient.get(`/rankings/${type}`),
  getMyRank: (type) => apiClient.get(`/rankings/${type}/me`),
};
