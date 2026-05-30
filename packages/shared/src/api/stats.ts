import { z } from "zod";

// GET /api/stats/me — SUM() over bigint returns a STRING (or null when no rows);
// COUNT() returns a number. The whole response is null when the player has no
// rounds.
export const MyStatsSchema = z
  .object({
    kills: z.string().nullable(),
    deaths: z.string().nullable(),
    wins: z.string().nullable(),
    shots: z.string().nullable(),
    hits: z.string().nullable(),
    plants: z.string().nullable(),
    blocks_destroyed: z.string().nullable(),
    rounds_played: z.number(),
  })
  .nullable();
export type MyStats = z.infer<typeof MyStatsSchema>;

// GET /api/rankings/:type and /:type/me. `total_data` is a string for
// KILLS/WINS (SUM) and a number for ROUNDS_PLAYED (COUNT); `rank` is a RANK()
// window result, a bigint serialized as a string.
export const RankingTypeSchema = z.enum(["KILLS", "WINS", "ROUNDS_PLAYED"]);
export type RankingType = z.infer<typeof RankingTypeSchema>;

export const RankingRowSchema = z.object({
  username: z.string(),
  total_data: z.union([z.string(), z.number()]),
  rank: z.string(),
});
export type RankingRow = z.infer<typeof RankingRowSchema>;

export const RankingsSchema = z.array(RankingRowSchema);
export type Rankings = z.infer<typeof RankingsSchema>;

// null when the user has no rounds / is not found in the computed ranking.
export const PersonalRankSchema = RankingRowSchema.nullable();
export type PersonalRank = z.infer<typeof PersonalRankSchema>;
