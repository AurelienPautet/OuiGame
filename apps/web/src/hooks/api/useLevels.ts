import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { levelsApi } from "../../api";
import { storage } from "../../lib/storage";
import type {
  SaveLevelRequest,
  CreateLevelResponse,
  SuccessResponse,
} from "@ouigame/shared/api";

export const useLevels = (params: {
  name?: string;
  players?: number;
  type?: string;
}) => {
  return useQuery({
    queryKey: ["levels", params],
    queryFn: () => levelsApi.getLevels(params),
  });
};

export const useMyLevels = (params: { name?: string; players?: number }) => {
  return useQuery({
    queryKey: ["levels", "my", params],
    queryFn: () => levelsApi.getMyLevels(params),
    enabled: storage.hasSession(),
  });
};

export const useLevel = (id: number | string) => {
  return useQuery({
    queryKey: ["levels", id],
    queryFn: () => levelsApi.getLevel(id),
    enabled: !!id,
  });
};

export const useLevelJson = (id: number | string) => {
  return useQuery({
    queryKey: ["levels", id, "json"],
    queryFn: () => levelsApi.getLevelJson(id),
    enabled: !!id,
  });
};

export const useSaveLevel = () => {
  const queryClient = useQueryClient();

  return useMutation<
    CreateLevelResponse | SuccessResponse,
    Error,
    SaveLevelRequest & { id?: number | string }
  >({
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
    mutationFn: (id: number | string) => levelsApi.deleteLevel(id),
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
    mutationFn: ({
      levelId,
      stars,
    }: {
      levelId: number | string;
      stars: number;
    }) => levelsApi.rateLevel(levelId, stars),
    onSuccess: (_, { levelId }) => {
      queryClient.invalidateQueries({ queryKey: ["levels", levelId] });
    },
  });
};
