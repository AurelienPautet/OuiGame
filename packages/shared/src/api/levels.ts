import { z } from "zod";

// `level_rating` and the `level_*` stat fields are un-coerced Postgres
// aggregates: a string when present, the JS number 0 when absent (formatLevels
// `|| 0`). Keep the union — modelling them as plain number would lie.
const aggStringOrZero = z.union([z.string(), z.number()]);

// The formatLevels DTO (GET /levels*, and the base of the
// "level_change_info" / "recieve_json_from_id" socket payloads). ALL snake_case.
// `level_type`/`level_status` are optional (GET /levels/my omits the columns).
export const LevelDTOSchema = z.object({
  level_id: z.number(),
  level_name: z.string(),
  level_max_players: z.number(),
  level_rating: aggStringOrZero,
  level_creator_name: z.string(),
  level_json: z.unknown(),
  level_img: z.string().nullable(),
  level_type: z.string().optional(),
  level_status: z.string().optional(),
  level_rounds_played: z.number(),
  level_kills: aggStringOrZero,
  level_deaths: aggStringOrZero,
  level_wins: aggStringOrZero,
  level_shots: aggStringOrZero,
  level_hits: aggStringOrZero,
  level_plants: aggStringOrZero,
  level_blocks_destroyed: aggStringOrZero,
  solo_times_played: z.number(),
  solo_success_rate: z.number(),
  solo_best_time_ms: z.number().nullable(),
});
export type LevelDTO = z.infer<typeof LevelDTOSchema>;

export const LevelListSchema = z.array(LevelDTOSchema);
export type LevelList = z.infer<typeof LevelListSchema>;

// The level rows pushed over the SOCKET (level_change_info / recieve_levels /
// recieve_my_levels) come from db_level.format_and_send_levels, which does NOT
// include the solo_* fields the REST formatLevels DTO carries. So the socket
// level shape is the REST DTO minus those three fields.
export type LevelInfoDTO = Omit<
  LevelDTO,
  "solo_times_played" | "solo_success_rate" | "solo_best_time_ms"
>;

// GET /levels/:id/json — only content.data plus 3 meta fields (distinct from
// `level_json`, which is the whole `content`).
export const LevelJsonResponseSchema = z.object({
  data: z.unknown(),
  level_name: z.string(),
  level_creator_name: z.string(),
  level_img: z.string().nullable(),
});
export type LevelJsonResponse = z.infer<typeof LevelJsonResponseSchema>;

// The "recieve_json_from_id" socket payload (typo verbatim) is exactly the
// 4-field GET /levels/:id/json shape — db_level.get_json_from_id returns only
// { data, level_name, level_creator_name, level_img }.
export type ReceiveJsonFromId = LevelJsonResponse;

// Mutation responses (camelCase wire).
export const CreateLevelResponseSchema = z.object({ levelId: z.number() });
export type CreateLevelResponse = z.infer<typeof CreateLevelResponseSchema>;

export const RateLevelResponseSchema = z.object({
  success: z.literal(true),
  stars: z.number(),
  levelId: z.number(),
});
export type RateLevelResponse = z.infer<typeof RateLevelResponseSchema>;

// Request body (camelCase wire), shared by POST and PUT /levels.
export const SaveLevelRequestSchema = z.object({
  levelData: z.unknown(),
  hexData: z.string(),
  levelName: z.string(),
  maxPlayers: z.number(),
  type: z.string(),
});
export type SaveLevelRequest = z.infer<typeof SaveLevelRequestSchema>;
