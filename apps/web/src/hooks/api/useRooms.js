import { useQuery } from "@tanstack/react-query";
import { roomsApi } from "../../api";

export const useRooms = () => {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: roomsApi.getRooms,
    refetchInterval: 5000, // Refresh every 5 seconds for semi-real-time updates
    refetchIntervalInBackground: false, // pause polling when the tab is hidden
  });
};
