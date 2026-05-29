import { useQuery } from "@tanstack/react-query";
import { rankingsApi } from "../../api";

export const useRankings = (type) => {
  return useQuery({
    queryKey: ["rankings", type],
    queryFn: () => rankingsApi.getRankings(type),
    enabled: !!type,
  });
};

export const usePersonalRank = (type) => {
  return useQuery({
    queryKey: ["rankings", type, "me"],
    queryFn: () => rankingsApi.getMyRank(type),
    enabled: !!type && !!localStorage.getItem("session_id"),
  });
};
