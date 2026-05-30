import { apiClient } from "../client";
import type { MyStats } from "@ouigame/shared/api";

export const statsApi = {
  getMyStats: () => apiClient.get<MyStats>("/stats/me"),
};
