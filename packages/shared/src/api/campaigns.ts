import { z } from "zod";

// The formatCampaigns DTO — all snake_case, all Number()/Math.round coerced
// server-side (real numbers).
export const CampaignDTOSchema = z.object({
  campaign_id: z.number(),
  campaign_name: z.string(),
  campaign_description: z.string(),
  campaign_creator_name: z.string(),
  level_count: z.number(),
  completion_percent: z.number(),
  completed: z.boolean(),
});
export type CampaignDTO = z.infer<typeof CampaignDTOSchema>;

export const CampaignListSchema = z.array(CampaignDTOSchema);
export type CampaignList = z.infer<typeof CampaignListSchema>;

// One element of the `levels` array attached only to GET /campaigns/:id.
export const CampaignLevelEntrySchema = z.object({
  level_id: z.number(),
  level_name: z.string(),
  level_creator_name: z.string(),
  level_img: z.string().nullable(),
  order_index: z.number(),
});
export type CampaignLevelEntry = z.infer<typeof CampaignLevelEntrySchema>;

// GET /campaigns/:id = CampaignDTO spread with a `levels` array.
export const CampaignDetailSchema = CampaignDTOSchema.extend({
  levels: z.array(CampaignLevelEntrySchema),
});
export type CampaignDetail = z.infer<typeof CampaignDetailSchema>;

// Request bodies (camelCase wire). `levelIds` is camelCase.
export const SaveCampaignRequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  levelIds: z.array(z.number()),
});
export type SaveCampaignRequest = z.infer<typeof SaveCampaignRequestSchema>;

// POST /campaigns/:id/runs — strict camelCase wire (the DB columns are
// levels_cleared / lives_left / time_ms).
export const SubmitCampaignRunRequestSchema = z.object({
  levelsCleared: z.number().int().nonnegative(),
  livesLeft: z.number().int().nonnegative().optional(),
  completed: z.boolean(),
  timeMs: z.number().int().nonnegative(),
});
export type SubmitCampaignRunRequest = z.infer<
  typeof SubmitCampaignRunRequestSchema
>;

// Mutation responses (camelCase wire).
export const CreateCampaignResponseSchema = z.object({
  campaignId: z.number(),
});
export type CreateCampaignResponse = z.infer<
  typeof CreateCampaignResponseSchema
>;

// Generic { success: true } envelope (delete, submit-run, etc.).
export const SuccessResponseSchema = z.object({ success: z.literal(true) });
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
