// Levels domain orchestration: compose the repos + shared formatting and apply
// business rules (ownership, insert-vs-update). NO req/res, NO socket. Routes
// call these; the socket server reuses getLevelJson/getLevel directly.
const levelsRepo = require("../repositories/levels.repo");
const ratingsRepo = require("../repositories/ratings.repo");
const {
  getCreatorName,
  getImgFromLevelId,
  formatLevels,
} = require("../repositories/shared/format");

// GET /api/levels — formatted list of public levels.
async function listLevels({ name, type, maxPlayers }) {
  const rows = await levelsRepo.list({ name, type, maxPlayers });
  return formatLevels(rows);
}

// GET /api/levels/my — formatted list of the player's levels.
async function listMyLevels(playerId, { name, maxPlayers }) {
  const rows = await levelsRepo.listMine({ name, playerId, maxPlayers });
  return formatLevels(rows);
}

// GET /api/levels/:id — one formatted level, or null when missing.
async function getLevel(levelId) {
  const rows = await levelsRepo.selectById(levelId);
  if (rows.length === 0) return null;
  const formatted = await formatLevels(rows);
  return formatted[0];
}

// GET /api/levels/:id/json — content payload for play, or null when missing.
async function getLevelJson(levelId) {
  const result = await levelsRepo.selectContentById(levelId);
  if (result.length === 0) return null;

  const row = result[0];
  const creatorName = await getCreatorName(row.creatorId);
  const img = await getImgFromLevelId(levelId);

  return {
    data: row.content.data,
    level_name: row.name,
    level_creator_name: creatorName,
    level_img: img,
  };
}

// POST /api/levels — create a level and its image, returning the new id.
async function saveLevel(
  playerId,
  { levelData, hexData, levelName, maxPlayers, type }
) {
  const result = await levelsRepo.insertLevel({
    name: levelName,
    content: levelData,
    creatorId: playerId,
    maxPlayers,
    type,
  });
  const levelId = result[0].id;
  await levelsRepo.insertLevelImg(levelId, hexData);
  return { levelId };
}

// PUT /api/levels/:id — update an owned level + its image. Returns null when
// the level isn't owned by the player.
async function updateLevel(
  playerId,
  levelId,
  { levelData, hexData, levelName, maxPlayers, type }
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
async function deleteLevel(playerId, levelId) {
  const existing = await levelsRepo.selectLevelOwnedBy(levelId, playerId);
  if (existing.length === 0) return false;
  await levelsRepo.deleteLevel(levelId);
  return true;
}

// POST /api/levels/:id/rate — upsert the player's rating.
async function rateLevel(playerId, levelId, stars) {
  await ratingsRepo.upsertRating(levelId, playerId, stars);
}

module.exports = {
  listLevels,
  listMyLevels,
  getLevel,
  getLevelJson,
  saveLevel,
  updateLevel,
  deleteLevel,
  rateLevel,
};
