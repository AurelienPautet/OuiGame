import { useQuery } from "@tanstack/react-query";
import { statsApi } from "../../api";
import { storage } from "../../lib/storage";

export const usePlayerStats = () => {
  return useQuery({
    queryKey: ["stats", "me"],
    queryFn: statsApi.getMyStats,
    enabled: storage.hasSession(),
  });
};
