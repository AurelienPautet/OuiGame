import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { storage } from "../../lib/storage";
import {
  levelLayoutFromContent,
  renderLevelThumbnailHex,
} from "../../lib/levelThumbnail";
import type {
  AdminUsersParams,
  AdminLevelsParams,
  AdminCampaignsParams,
  AdminLoginsParams,
  AdminAuditParams,
  AdminTimeseriesParams,
  AdminConnectedPlayersParams,
} from "../../api/endpoints/admin";
import type {
  AdminUpdateUserRequest,
  AdminUpdateLevelRequest,
  AdminTimeseriesRange,
} from "@ouigame/shared/api";

// Every admin query is gated on a live session (the routes are admin-only on the
// server) and shares a 30s staleTime — the dashboard is read-mostly.
const STALE_TIME = 30 * 1000;

export const useAdminOverview = () => {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: adminApi.getOverview,
    enabled: storage.hasSession(),
    staleTime: STALE_TIME,
  });
};

export const useAdminTimeseries = (
  windowOrDays: number | string | AdminTimeseriesParams = "30d"
) => {
  const params: AdminTimeseriesParams =
    typeof windowOrDays === "number"
      ? { days: windowOrDays }
      : typeof windowOrDays === "string"
        ? ["24h", "7d", "30d", "90d"].includes(windowOrDays)
          ? { range: windowOrDays as AdminTimeseriesRange }
          : { days: Number(windowOrDays) }
        : windowOrDays;

  return useQuery({
    queryKey: ["admin", "timeseries", params],
    queryFn: () => adminApi.getTimeseries(params),
    enabled: storage.hasSession(),
    staleTime: STALE_TIME,
  });
};

export const useAdminConnectedPlayers = (
  params?: AdminConnectedPlayersParams,
  options?: { refetchInterval?: number | false }
) => {
  return useQuery({
    queryKey: ["admin", "connected-players", params],
    queryFn: () => adminApi.getConnectedPlayers(params),
    enabled: storage.hasSession(),
    staleTime: 5 * 1000,
    refetchInterval: options?.refetchInterval ?? 5000,
  });
};

export const useAdminUsers = (params: AdminUsersParams) => {
  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => adminApi.getUsers(params),
    enabled: storage.hasSession(),
    staleTime: STALE_TIME,
  });
};

export const useAdminUser = (id: number) => {
  return useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => adminApi.getUser(id),
    enabled: storage.hasSession() && id > 0,
    staleTime: STALE_TIME,
  });
};

export const useAdminLevels = (params: AdminLevelsParams) => {
  return useQuery({
    queryKey: ["admin", "levels", params],
    queryFn: () => adminApi.getLevels(params),
    enabled: storage.hasSession(),
    staleTime: STALE_TIME,
  });
};

export const useAdminCampaigns = (params: AdminCampaignsParams) => {
  return useQuery({
    queryKey: ["admin", "campaigns", params],
    queryFn: () => adminApi.getCampaigns(params),
    enabled: storage.hasSession(),
    staleTime: STALE_TIME,
  });
};

export const useAdminLogins = (params: AdminLoginsParams) => {
  return useQuery({
    queryKey: ["admin", "logins", params],
    queryFn: () => adminApi.getLogins(params),
    enabled: storage.hasSession(),
    staleTime: STALE_TIME,
  });
};

export const useAdminAudit = (params: AdminAuditParams) => {
  return useQuery({
    queryKey: ["admin", "audit", params],
    queryFn: () => adminApi.getAudit(params),
    enabled: storage.hasSession(),
    staleTime: STALE_TIME,
  });
};

// --- Mutations ----------------------------------------------------------------

export const useUpdateAdminUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & AdminUpdateUserRequest) =>
      adminApi.updateUser(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "user"] });
    },
  });
};

export const useDeleteAdminUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
};

export const useUpdateAdminLevel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & AdminUpdateLevelRequest) =>
      adminApi.updateLevel(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "levels"] });
    },
  });
};

// --- Re-render all level thumbnails -----------------------------------------

// Progress reported while the maintenance job walks the level catalog.
export interface ThumbnailRerenderProgress {
  done: number;
  total: number;
  failed: number;
}

export interface ThumbnailRerenderResult extends ThumbnailRerenderProgress {
  /** True when the caller's shouldStop() cut the run short. */
  stopped: boolean;
}

// The catalog endpoint caps pageSize at 100 (AdminPagedQuerySchema).
const THUMBNAIL_PAGE_SIZE = 100;

// Admin maintenance job: redraw every level's thumbnail from its stored layout
// with the CURRENT renderer (engine/levelScene + lib/levelThumbnail) and save
// the new bytes back. Runs in the browser because the renderer is canvas-based;
// uses the same save path as the level editor, so a UI/style change can be
// pushed to all existing levels with one click.
//
// Callers pass `onProgress` for the UI and `shouldStop` so a Stop button can
// end the run between levels. A per-level render/save failure counts as
// `failed` and the job continues; only a catalog fetch failure rejects.
export const useRerenderAdminLevelThumbnails = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      onProgress,
      shouldStop,
    }: {
      onProgress?: (progress: ThumbnailRerenderProgress) => void;
      shouldStop?: () => boolean;
    } = {}): Promise<ThumbnailRerenderResult> => {
      let page = 1;
      let done = 0;
      let failed = 0;
      let total = 0;
      let stopped = false;

      for (;;) {
        const source = await adminApi.getLevelThumbnailSources({
          page,
          pageSize: THUMBNAIL_PAGE_SIZE,
        });
        total = source.total;

        for (const level of source.levels) {
          if (shouldStop?.()) {
            stopped = true;
            break;
          }
          const layout = levelLayoutFromContent(level.content);
          const hexData = layout ? renderLevelThumbnailHex(layout) : null;
          if (hexData === null) {
            failed += 1;
          } else {
            try {
              await adminApi.updateLevelThumbnail(level.id, { hexData });
              done += 1;
            } catch {
              failed += 1;
            }
          }
          onProgress?.({ done, total, failed });
        }

        const processed = done + failed;
        if (stopped || source.levels.length === 0 || processed >= total) {
          break;
        }
        page += 1;
      }

      return { done, total, failed, stopped };
    },
    onSuccess: ({ done }) => {
      if (done === 0) return;
      // Both the admin list and the public/My-Levels cards read the thumbnail.
      queryClient.invalidateQueries({
        queryKey: ["admin", "levels"],
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: ["levels"],
        refetchType: "active",
      });
    },
  });
};

export const useDeleteAdminLevel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => adminApi.deleteLevel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "levels"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
};

export const useDeleteAdminCampaign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => adminApi.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
  });
};
