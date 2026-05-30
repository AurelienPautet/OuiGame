import { z } from "zod";

// GET /api/rooms — served from the in-memory socket `rooms` map (NOT the DB).
// `maxPlayers` (from room.maxplayernb) and `players` (a count) are camelCase.
export const RoomSummarySchema = z.object({
  id: z.union([z.number(), z.string()]),
  name: z.string(),
  creator: z.string(),
  players: z.number(),
  maxPlayers: z.number(),
});
export type RoomSummary = z.infer<typeof RoomSummarySchema>;

export const RoomListSchema = z.array(RoomSummarySchema);
export type RoomList = z.infer<typeof RoomListSchema>;
