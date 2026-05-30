import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { soloApi } from "../../api";

/**
 * Submit a solo round - works for both logged-in and anonymous users
 */
export const useSubmitSoloRound = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: soloApi.submitRound,
    onSuccess: (_data, variables) => {
      // Invalidate level stats for the played level
      queryClient.invalidateQueries({
        queryKey: ["solo", "levelStats", variables.levelId],
      });
      queryClient.invalidateQueries({
        queryKey: ["solo", "levelLeaderboard", variables.levelId],
      });
      // Invalidate my solo stats if user is logged in
      if (localStorage.getItem("session_id")) {
        queryClient.invalidateQueries({
          queryKey: ["solo", "myStats"],
        });
        queryClient.invalidateQueries({
          queryKey: ["solo", "globalLeaderboard"],
        });
      }

      // Invalidate levels lists to update play counts/stats on cards
      // This covers both ["levels", ...] and ["levels", "my", ...]
      queryClient.invalidateQueries({
        queryKey: ["levels"],
        refetchType: "active",
      });
    },
  });
};

/**
 * Get stats for a specific level (success rate, times played, best time)
 */
export const useLevelSoloStats = (levelId) => {
  return useQuery({
    queryKey: ["solo", "levelStats", levelId],
    queryFn: () => soloApi.getLevelStats(levelId),
    enabled: !!levelId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Get per-level leaderboard (best times)
 */
export const useLevelLeaderboard = (levelId, limit = 20) => {
  return useQuery({
    queryKey: ["solo", "levelLeaderboard", levelId, limit],
    queryFn: () => soloApi.getLevelLeaderboard(levelId, limit),
    enabled: !!levelId,
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Get global solo leaderboard by type
 * Types: LEVELS_COMPLETED, LEVELS_PLAYED, KILLS
 * Only includes logged-in players
 */
export const useGlobalSoloLeaderboard = (type, limit = 50) => {
  return useQuery({
    queryKey: ["solo", "globalLeaderboard", type, limit],
    queryFn: () => soloApi.getGlobalLeaderboard(type, limit),
    enabled: !!type,
    staleTime: 60 * 1000, // 1 minute
  });
};

/**
 * Get current user's solo stats
 */
export const useMySoloStats = () => {
  return useQuery({
    queryKey: ["solo", "myStats"],
    queryFn: soloApi.getMySoloStats,
    enabled: !!localStorage.getItem("session_id"),
    staleTime: 30 * 1000, // 30 seconds
  });
};
