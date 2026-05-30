import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { campaignsApi } from "../../api";
import { storage } from "../../lib/storage";
import type {
  SaveCampaignRequest,
  SubmitCampaignRunRequest,
  CreateCampaignResponse,
  SuccessResponse,
} from "@ouigame/shared/api";

export const useCampaigns = (params: { name?: string }) => {
  return useQuery({
    queryKey: ["campaigns", params],
    queryFn: () => campaignsApi.getCampaigns(params),
  });
};

export const useMyCampaigns = (params: { name?: string }) => {
  return useQuery({
    queryKey: ["campaigns", "my", params],
    queryFn: () => campaignsApi.getMyCampaigns(params),
    enabled: storage.hasSession(),
  });
};

export const useCampaign = (id: number | string) => {
  return useQuery({
    queryKey: ["campaigns", id],
    queryFn: () => campaignsApi.getCampaign(id),
    enabled: !!id,
  });
};

export const useSaveCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation<
    CreateCampaignResponse | SuccessResponse,
    Error,
    SaveCampaignRequest & { id?: number | string }
  >({
    mutationFn: ({ id, ...data }) =>
      id
        ? campaignsApi.updateCampaign(id, data)
        : campaignsApi.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns"],
        refetchType: "active",
      });
    },
  });
};

export const useDeleteCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number | string) => campaignsApi.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns"],
        refetchType: "active",
      });
    },
  });
};

/**
 * Record a campaign run (completed or out of lives). Works for logged-in and
 * anonymous players; refreshes completion % / Completed badges on the lists.
 */
export const useSubmitCampaignRun = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      campaignId,
      ...data
    }: SubmitCampaignRunRequest & { campaignId: number | string }) =>
      campaignsApi.submitRun(campaignId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["campaigns"],
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: ["campaigns", variables.campaignId],
      });
    },
  });
};
