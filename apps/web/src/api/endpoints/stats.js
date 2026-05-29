import { apiClient } from "../client";

export const statsApi = {
  getMyStats: () => apiClient.get("/stats/me"),
};
