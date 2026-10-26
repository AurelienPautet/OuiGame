import { apiClient } from "../client";
import type {
  AdminOverview,
  AdminTimeseries,
  AdminConnectedPlayersResponse,
  AdminConnectedPlayersQuery,
  AdminUsersResponse,
  AdminUserDetail,
  AdminUpdateUserRequest,
  AdminLevelsResponse,
  AdminUpdateLevelRequest,
  AdminLevelThumbnailsResponse,
  AdminUpdateLevelThumbnailRequest,
  AdminCampaignsResponse,
  AdminLoginsResponse,
  AdminAuditResponse,
  AdminUsersQuery,
  AdminLevelsQuery,
  AdminPagedQuery,
  AdminLoginsQuery,
  SuccessResponse,
} from "@ouigame/shared/api";

// The list endpoints reuse the inferred request-query types from the shared
// contract, so the param shapes can never drift from what the server parses.
export type AdminUsersParams = AdminUsersQuery;
export type AdminLevelsParams = AdminLevelsQuery;
export type AdminCampaignsParams = AdminPagedQuery;
export type AdminLoginsParams = AdminLoginsQuery;
export type AdminAuditParams = AdminPagedQuery;
export type AdminConnectedPlayersParams = AdminConnectedPlayersQuery;

// Build a `?a=b&c=d` query string, dropping undefined params so optional
// filters don't leak as empty values onto the wire.
function toQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface AdminTimeseriesParams {
  [key: string]: string | number | undefined;
  days?: number;
  range?: "24h" | "7d" | "30d" | "90d";
}

export const adminApi = {
  getOverview: () => apiClient.get<AdminOverview>("/admin/overview"),

  getTimeseries: (params?: number | AdminTimeseriesParams) => {
    const query =
      typeof params === "number" ? { days: params } : (params ?? {});
    return apiClient.get<AdminTimeseries>(`/admin/timeseries${toQuery(query)}`);
  },

  getConnectedPlayers: (params?: AdminConnectedPlayersParams) =>
    apiClient.get<AdminConnectedPlayersResponse>(
      `/admin/connected-players${toQuery({
        type: params?.type,
        search: params?.search,
      })}`
    ),

  getUsers: (params: AdminUsersParams) =>
    apiClient.get<AdminUsersResponse>(
      `/admin/users${toQuery({
        search: params.search,
        sort: params.sort,
        order: params.order,
        type: params.type,
        page: params.page,
        pageSize: params.pageSize,
      })}`
    ),

  getUser: (id: number) => apiClient.get<AdminUserDetail>(`/admin/users/${id}`),

  updateUser: (id: number, body: AdminUpdateUserRequest) =>
    apiClient.patch<SuccessResponse>(`/admin/users/${id}`, body),

  deleteUser: (id: number) =>
    apiClient.delete<SuccessResponse>(`/admin/users/${id}`),

  getLevels: (params: AdminLevelsParams) =>
    apiClient.get<AdminLevelsResponse>(
      `/admin/levels${toQuery({
        search: params.search,
        status: params.status,
        sort: params.sort,
        order: params.order,
        page: params.page,
        pageSize: params.pageSize,
      })}`
    ),

  // Level layouts (id/name/content) for the thumbnail maintenance job.
  getLevelThumbnailSources: (params: AdminPagedQuery) =>
    apiClient.get<AdminLevelThumbnailsResponse>(
      `/admin/levels/thumbnails${toQuery({
        page: params.page,
        pageSize: params.pageSize,
      })}`
    ),

  updateLevelThumbnail: (id: number, body: AdminUpdateLevelThumbnailRequest) =>
    apiClient.put<SuccessResponse>(`/admin/levels/${id}/thumbnail`, body),

  updateLevel: (id: number, body: AdminUpdateLevelRequest) =>
    apiClient.patch<SuccessResponse>(`/admin/levels/${id}`, body),

  deleteLevel: (id: number) =>
    apiClient.delete<SuccessResponse>(`/admin/levels/${id}`),

  getCampaigns: (params: AdminCampaignsParams) =>
    apiClient.get<AdminCampaignsResponse>(
      `/admin/campaigns${toQuery({
        search: params.search,
        page: params.page,
        pageSize: params.pageSize,
      })}`
    ),

  deleteCampaign: (id: number) =>
    apiClient.delete<SuccessResponse>(`/admin/campaigns/${id}`),

  getLogins: (params: AdminLoginsParams) =>
    apiClient.get<AdminLoginsResponse>(
      `/admin/logins${toQuery({
        search: params.search,
        status: params.status,
        page: params.page,
        pageSize: params.pageSize,
      })}`
    ),

  getAudit: (params: AdminAuditParams) =>
    apiClient.get<AdminAuditResponse>(
      `/admin/audit${toQuery({
        search: params.search,
        page: params.page,
        pageSize: params.pageSize,
      })}`
    ),
};
