import { apiClient } from "../client";

export const campaignsApi = {
  getCampaigns: ({ name = "" }) =>
    apiClient.get(`/campaigns?name=${encodeURIComponent(name)}`),

  getMyCampaigns: ({ name = "" }) =>
    apiClient.get(`/campaigns/my?name=${encodeURIComponent(name)}`),

  getCampaign: (id) => apiClient.get(`/campaigns/${id}`),

  createCampaign: (data) => apiClient.post("/campaigns", data),

  updateCampaign: (id, data) => apiClient.put(`/campaigns/${id}`, data),

  deleteCampaign: (id) => apiClient.delete(`/campaigns/${id}`),

  submitRun: (id, data) => apiClient.post(`/campaigns/${id}/runs`, data),
};
