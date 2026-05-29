import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { levelsApi } from "../../api";

export const useLevels = (params) => {
  return useQuery({
    queryKey: ["levels", params],
    queryFn: () => levelsApi.getLevels(params),
  });
};

export const useMyLevels = (params) => {
  return useQuery({
    queryKey: ["levels", "my", params],
    queryFn: () => levelsApi.getMyLevels(params),
    enabled: !!localStorage.getItem("session_id"),
  });
};

export const useLevel = (id) => {
  return useQuery({
    queryKey: ["levels", id],
    queryFn: () => levelsApi.getLevel(id),
    enabled: !!id,
  });
};

export const useLevelJson = (id) => {
  return useQuery({
    queryKey: ["levels", id, "json"],
    queryFn: () => levelsApi.getLevelJson(id),
    enabled: !!id,
  });
};

export const useSaveLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }) =>
      id ? levelsApi.updateLevel(id, data) : levelsApi.createLevel(data),
    onSuccess: () => {
      // Invalidate all levels queries including filtered ones and 'my levels'
      queryClient.invalidateQueries({
        queryKey: ["levels"],
        refetchType: "active",
      });
    },
  });
};

export const useDeleteLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => levelsApi.deleteLevel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["levels"],
        refetchType: "active",
      });
    },
  });
};

export const useRateLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ levelId, stars }) => levelsApi.rateLevel(levelId, stars),
    onSuccess: (_, { levelId }) => {
      queryClient.invalidateQueries({ queryKey: ["levels", levelId] });
    },
  });
};
