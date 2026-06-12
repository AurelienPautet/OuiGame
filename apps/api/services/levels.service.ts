// Levels domain orchestration: compose the repos + shared formatting and apply
// business rules (ownership, insert-vs-update). NO req/res, NO socket. Routes
// call these; the socket server reuses getLevelJson/getLevel directly.
import * as levelsRepo from "../repositories/levels.repo";
import * as ratingsRepo from "../repositories/ratings.repo";
import {
  getCreatorName,
  getImgFromLevelId,
  formatLevels,
} from "../repositories/shared/format";
import { countBotSpawnCells } from "@ouigame/shared/game";
import type { SaveLevelRequest } from "@ouigame/shared/api";

// GET /api/levels — formatted list of public levels. The route always supplies
// name/type/maxPlayers (defaulting to ""/"online"/0), matching the repo filter.
async function listLevels({
  name,
  type,
  maxPlayers,
}: {
  name: string;
  type: string;
  maxPlayers: number;
}) {
  const rows = await levelsRepo.list({ name, type, maxPlayers });
  return formatLevels(rows);
}

// GET /api/levels/my — formatted list of the player's levels. The route always
// supplies name/maxPlayers (defaulting to ""/0), matching the repo filter.
async function listMyLevels(
  playerId: number,
  { name, maxPlayers }: { name: string; maxPlayers: number }
) {
  const rows = await levelsRepo.listMine({ name, playerId, maxPlayers });
  return formatLevels(rows);
}

// GET /api/levels/:id — one formatted level, or null when missing.
async function getLevel(levelId: number) {
  const rows = await levelsRepo.selectById(levelId);
  if (rows.length === 0) return null;
  const formatted = await formatLevels(rows);
  return formatted[0];
}

// GET /api/levels/:id/json — content payload for play, or null when missing.
async function getLevelJson(levelId: number) {
  const result = await levelsRepo.selectContentById(levelId);
  const row = result[0];
  if (row === undefined) return null;

  const creatorName = await getCreatorName(row.creatorId);
  const img = await getImgFromLevelId(levelId);

  // `content` is a Drizzle `json` column (typed `unknown`); narrow to the
  // `{ data }` envelope the level payload is stored as.
  const content = row.content as { data: unknown };
  return {
    data: content.data,
    level_name: row.name,
    level_creator_name: creatorName,
    level_img: img,
  };
}

// POST /api/levels — create a level and its image, returning the new id. The
// route Zod-validates the body with SaveLevelRequestSchema, so SaveLevelRequest
// is the sound write contract (all fields required).
async function saveLevel(
  playerId: number,
  { levelData, hexData, levelName, maxPlayers, type }: SaveLevelRequest
) {
  const result = await levelsRepo.insertLevel({
    name: levelName,
    content: levelData,
    creatorId: playerId,
    maxPlayers,
    type,
  });
  // A single-row insert with .returning() always yields exactly one row.
  const levelId = result[0]!.id;
  await levelsRepo.insertLevelImg(levelId, hexData);
  return { levelId };
}

// PUT /api/levels/:id — update an owned level + its image. Returns null when
// the level isn't owned by the player.
async function updateLevel(
  playerId: number,
  levelId: number,
  { levelData, hexData, levelName, maxPlayers, type }: SaveLevelRequest
) {
  const existing = await levelsRepo.selectLevelOwnedBy(levelId, playerId);
  if (existing.length === 0) return null;

  await levelsRepo.updateLevel(levelId, playerId, {
    name: levelName,
    content: levelData,
    maxPlayers,
    type,
  });
  await levelsRepo.updateLevelImg(levelId, hexData);
  return { levelId };
}

// DELETE /api/levels/:id — delete an owned level (children via cascade).
// Returns false when the level isn't owned by the player, true otherwise.
async function deleteLevel(playerId: number, levelId: number) {
  const existing = await levelsRepo.selectLevelOwnedBy(levelId, playerId);
  if (existing.length === 0) return false;
  await levelsRepo.deleteLevel(levelId);
  return true;
}

// POST /api/levels/:id/rate — upsert the player's rating.
async function rateLevel(playerId: number, levelId: number, stars: number) {
  await ratingsRepo.upsertRating(levelId, playerId, stars);
}

// Coop playlist gate: every level must exist, be a solo-type level, and carry
// at least one bot spawn cell (codes 11–16) — a botless level would read as
// an instant team win every round. The reason string travels to the client
// verbatim via room_create_failed.
async function validateCoopLevels(
  levelIds: number[]
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (levelIds.length === 0) return { ok: false, reason: "level_not_found" };
  const rows = await levelsRepo.getTypesAndContents(levelIds);
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of levelIds) {
    const row = byId.get(id);
    if (!row) return { ok: false, reason: "level_not_found" };
    if (row.type !== "solo") return { ok: false, reason: "not_solo" };
    // `content` is the `{ data }` envelope of a Drizzle json column.
    const grid = (row.content as { data?: unknown } | null)?.data;
    if (!Array.isArray(grid) || countBotSpawnCells(grid as number[]) === 0) {
      return { ok: false, reason: "no_bot_spawns" };
    }
    // The editor enforces a player spawn client-side, but level content is
    // never validated at save (levelData is unknown on the wire), so the coop
    // gate is the only server-side line of defense: without a code-3 cell the
    // spawn pool starts empty and the capacity BFS has no anchor to grow from.
    if (!(grid as number[]).includes(3)) {
      return { ok: false, reason: "no_player_spawn" };
    }
  }
  return { ok: true };
}

export {
  listLevels,
  listMyLevels,
  getLevel,
  getLevelJson,
  saveLevel,
  updateLevel,
  deleteLevel,
  rateLevel,
  validateCoopLevels,
};
