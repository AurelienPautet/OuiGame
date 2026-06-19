import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api";
import { storage } from "../../lib/storage";
import type {
  AdminUsersParams,
  AdminLevelsParams,
  AdminCampaignsParams,
  AdminLoginsParams,
  AdminAuditParams,
} from "../../api/endpoints/admin";
import type {
  AdminUpdateUserRequest,
  AdminUpdateLevelRequest,
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

export const useAdminTimeseries = (days: number) => {
  return useQuery({
    queryKey: ["admin", "timeseries", days],
    queryFn: () => adminApi.getTimeseries(days),
    enabled: storage.hasSession(),
    staleTime: STALE_TIME,
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
