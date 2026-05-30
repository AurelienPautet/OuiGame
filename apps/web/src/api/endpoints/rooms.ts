import { apiClient } from "../client";
import type { RoomList } from "@ouigame/shared/api";

// Phase 1b adoption demo #2: a clean read-only GET typed against the shared DTO,
// feeding the useRooms react-query hook (its `data` now infers RoomList).
export const roomsApi = {
  getRooms: () => apiClient.get<RoomList>("/rooms"),
};
