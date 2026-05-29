import { apiClient } from "../client";

export const levelsApi = {
  getLevels: ({ name = "", players = 0, type = "online" }) =>
    apiClient.get(
      `/levels?name=${encodeURIComponent(name)}&players=${players}&type=${type}`
    ),

  getMyLevels: ({ name = "", players = 0 }) =>
    apiClient.get(
      `/levels/my?name=${encodeURIComponent(name)}&players=${players}`
    ),

  getLevel: (id) => apiClient.get(`/levels/${id}`),

  getLevelJson: (id) => apiClient.get(`/levels/${id}/json`),

  createLevel: (data) => apiClient.post("/levels", data),

  updateLevel: (id, data) => apiClient.put(`/levels/${id}`, data),

  deleteLevel: (id) => apiClient.delete(`/levels/${id}`),

  rateLevel: (id, stars) => apiClient.post(`/levels/${id}/rate`, { stars }),
};
