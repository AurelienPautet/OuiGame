import { apiClient } from "../client";
import type {
  LevelList,
  LevelDTO,
  LevelJsonResponse,
  CreateLevelResponse,
  RateLevelResponse,
  SaveLevelRequest,
  SuccessResponse,
} from "@ouigame/shared/api";

export const levelsApi = {
  getLevels: ({
    name = "",
    players = 0,
    type = "online",
  }: {
    name?: string;
    players?: number;
    type?: string;
  }) =>
    apiClient.get<LevelList>(
      `/levels?name=${encodeURIComponent(name)}&players=${players}&type=${type}`
    ),

  getMyLevels: ({
    name = "",
    players = 0,
  }: {
    name?: string;
    players?: number;
  }) =>
    apiClient.get<LevelList>(
      `/levels/my?name=${encodeURIComponent(name)}&players=${players}`
    ),

  getLevel: (id: number | string) => apiClient.get<LevelDTO>(`/levels/${id}`),

  getLevelJson: (id: number | string) =>
    apiClient.get<LevelJsonResponse>(`/levels/${id}/json`),

  createLevel: (data: SaveLevelRequest) =>
    apiClient.post<CreateLevelResponse>("/levels", data),

  updateLevel: (id: number | string, data: SaveLevelRequest) =>
    apiClient.put<SuccessResponse>(`/levels/${id}`, data),

  deleteLevel: (id: number | string) =>
    apiClient.delete<SuccessResponse>(`/levels/${id}`),

  rateLevel: (id: number | string, stars: number) =>
    apiClient.post<RateLevelResponse>(`/levels/${id}/rate`, { stars }),
};
