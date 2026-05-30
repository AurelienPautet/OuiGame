import { apiClient } from "../client";
import type {
  CampaignList,
  CampaignDetail,
  SaveCampaignRequest,
  SubmitCampaignRunRequest,
  CreateCampaignResponse,
  SuccessResponse,
} from "@ouigame/shared/api";

export const campaignsApi = {
  getCampaigns: ({ name = "" }: { name?: string }) =>
    apiClient.get<CampaignList>(`/campaigns?name=${encodeURIComponent(name)}`),

  getMyCampaigns: ({ name = "" }: { name?: string }) =>
    apiClient.get<CampaignList>(
      `/campaigns/my?name=${encodeURIComponent(name)}`
    ),

  getCampaign: (id: number | string) =>
    apiClient.get<CampaignDetail>(`/campaigns/${id}`),

  createCampaign: (data: SaveCampaignRequest) =>
    apiClient.post<CreateCampaignResponse>("/campaigns", data),

  updateCampaign: (id: number | string, data: SaveCampaignRequest) =>
    apiClient.put<SuccessResponse>(`/campaigns/${id}`, data),

  deleteCampaign: (id: number | string) =>
    apiClient.delete<SuccessResponse>(`/campaigns/${id}`),

  submitRun: (id: number | string, data: SubmitCampaignRunRequest) =>
    apiClient.post<SuccessResponse>(`/campaigns/${id}/runs`, data),
};
