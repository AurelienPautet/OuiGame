import { useQuery } from "@tanstack/react-query";
import { statsApi } from "../../api";

export const usePlayerStats = () => {
  return useQuery({
    queryKey: ["stats", "me"],
    queryFn: statsApi.getMyStats,
    enabled: !!localStorage.getItem("session_id"),
  });
};
