import { apiClient } from "../client";
import type { MyAchievements } from "@ouigame/shared/api";

export const achievementsApi = {
  // The current user's unlocked achievements (rows + timestamps). The full
  // catalog of locked + unlocked lives client-side in constants/achievements.ts.
  getMine: () => apiClient.get<MyAchievements>("/achievements/me"),
};
