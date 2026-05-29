import { apiClient } from "../client";

export const roomsApi = {
  getRooms: () => apiClient.get("/rooms"),
};
