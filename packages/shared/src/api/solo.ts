import { z } from "zod";

// POST /solo/rounds — camelCase wire; the optional stats default to 0 server-side.
export const SubmitSoloRoundRequestSchema = z.object({
  levelId: z.number(),
  success: z.boolean(),
  timeMs: z.number(),
  kills: z.number().optional(),
  deaths: z.number().optional(),
  shots: z.number().optional(),
  hits: z.number().optional(),
  plants: z.number().optional(),
  blocksDestroyed: z.number().optional(),
});
export type SubmitSoloRoundRequest = z.infer<
  typeof SubmitSoloRoundRequestSchema
>;

// GET /solo/levels/:id/stats — camelCase response (Number()/Math.round coerced).
export const SoloLevelStatsSchema = z.object({
  timesPlayed: z.number(),
  successRate: z.number(),
  bestTimeMs: z.number().nullable(),
  avgTimeMs: z.number().nullable(),
});
export type SoloLevelStats = z.infer<typeof SoloLevelStatsSchema>;

// GET /solo/levels/:id/leaderboard
export const SoloLevelLeaderboardRowSchema = z.object({
  rank: z.number(),
  username: z.string(),
  timeMs: z.number(),
});
export const SoloLevelLeaderboardSchema = z.array(
  SoloLevelLeaderboardRowSchema
);
export type SoloLevelLeaderboard = z.infer<typeof SoloLevelLeaderboardSchema>;

// GET /solo/leaderboard/:type
export const SoloGlobalTypeSchema = z.enum([
  "LEVELS_COMPLETED",
  "LEVELS_PLAYED",
  "KILLS",
]);
export type SoloGlobalType = z.infer<typeof SoloGlobalTypeSchema>;

export const SoloGlobalLeaderboardRowSchema = z.object({
  rank: z.number(),
  username: z.string(),
  total_data: z.number(),
});
export const SoloGlobalLeaderboardSchema = z.array(
  SoloGlobalLeaderboardRowSchema
);
export type SoloGlobalLeaderboard = z.infer<typeof SoloGlobalLeaderboardSchema>;

// GET /solo/stats/me — camelCase response (all Number()-coerced).
export const MySoloStatsSchema = z.object({
  levelsCompleted: z.number(),
  totalRounds: z.number(),
  totalWins: z.number(),
  winRate: z.number(),
  totalKills: z.number(),
  totalDeaths: z.number(),
  avgAccuracy: z.number(),
});
export type MySoloStats = z.infer<typeof MySoloStatsSchema>;
