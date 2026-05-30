import { useQuery } from "@tanstack/react-query";
import { rankingsApi } from "../../api";
import { storage } from "../../lib/storage";
import type { RankingType } from "@ouigame/shared/api";

export const useRankings = (type: RankingType) => {
  return useQuery({
    queryKey: ["rankings", type],
    queryFn: () => rankingsApi.getRankings(type),
    enabled: !!type,
  });
};

export const usePersonalRank = (type: RankingType) => {
  return useQuery({
    queryKey: ["rankings", type, "me"],
    queryFn: () => rankingsApi.getMyRank(type),
    enabled: !!type && storage.hasSession(),
  });
};
