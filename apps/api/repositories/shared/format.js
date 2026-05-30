// Shared level-formatting helpers, used by the levels and campaigns services.
// Pure data access + shaping — NO req/res, NO socket. The batched lookups avoid
// an N+1 over a list of levels (four grouped queries instead of ~four per row).
// Extracted verbatim from the old inline route helpers so the wire shapes are
// byte-for-byte unchanged.
const { db, schema } = require("@ouigame/db");
const { levelsImg, rounds, players, soloRounds } = schema;
const { eq, sql, count, sum, inArray } = require("drizzle-orm");

// Parse a positive-integer path/query param, or null if it isn't one.
function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function getCreatorName(creatorId) {
  const res = await db
    .select({ username: players.username })
    .from(players)
    .where(eq(players.id, creatorId));
  return res.length > 0 ? res[0].username : "Unknown";
}

async function getImgFromLevelId(levelId) {
  const res = await db
    .select({ img: levelsImg.img })
    .from(levelsImg)
    .where(eq(levelsImg.levelId, levelId));
  if (res.length === 0) return null;
  return res[0].img.toString("hex");
}

// --- Batched lookups used by formatLevels (avoids N+1 over a list) ---

async function getCreatorNames(creatorIds) {
  const ids = [...new Set(creatorIds.filter((id) => id != null))];
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: players.id, username: players.username })
    .from(players)
    .where(inArray(players.id, ids));
  return new Map(rows.map((r) => [r.id, r.username]));
}

async function getImagesByLevelId(levelIds) {
  if (levelIds.length === 0) return new Map();
  const rows = await db
    .select({ levelId: levelsImg.levelId, img: levelsImg.img })
    .from(levelsImg)
    .where(inArray(levelsImg.levelId, levelIds));
  return new Map(
    rows.map((r) => [r.levelId, r.img ? r.img.toString("hex") : null])
  );
}

async function getStatsByLevelId(levelIds) {
  if (levelIds.length === 0) return new Map();
  const rows = await db
    .select({
      levelId: rounds.levelId,
      rounds_played: count(rounds.id),
      kills: sum(rounds.kills),
      deaths: sum(rounds.deaths),
      wins: sum(rounds.wins),
      shots: sum(rounds.shots),
      hits: sum(rounds.hits),
      plants: sum(rounds.plants),
      blocks_destroyed: sum(rounds.blocksDestroyed),
    })
    .from(rounds)
    .where(inArray(rounds.levelId, levelIds))
    .groupBy(rounds.levelId);
  return new Map(rows.map((r) => [r.levelId, r]));
}

async function getSoloStatsByLevelId(levelIds) {
  if (levelIds.length === 0) return new Map();
  const rows = await db
    .select({
      levelId: soloRounds.levelId,
      timesPlayed: count(soloRounds.id),
      totalWins: sum(sql`CASE WHEN ${soloRounds.success} THEN 1 ELSE 0 END`),
      bestTimeMs: sql`MIN(CASE WHEN ${soloRounds.success} THEN ${soloRounds.timeMs} END)`,
    })
    .from(soloRounds)
    .where(inArray(soloRounds.levelId, levelIds))
    .groupBy(soloRounds.levelId);
  return new Map(
    rows.map((r) => {
      const timesPlayed = Number(r.timesPlayed) || 0;
      const totalWins = Number(r.totalWins) || 0;
      return [
        r.levelId,
        {
          times_played: timesPlayed,
          success_rate:
            timesPlayed > 0 ? Math.round((totalWins / timesPlayed) * 100) : 0,
          best_time_ms: r.bestTimeMs ? Number(r.bestTimeMs) : null,
        },
      ];
    })
  );
}

// Shape a list of raw level rows (each needs id/name/content/creatorId/
// maxPlayers/rating and, where present, type/status) into the wire `level_*`
// objects the client expects.
async function formatLevels(rows) {
  if (rows.length === 0) return [];

  const levelIds = rows.map((r) => r.id);
  const soloLevelIds = rows.filter((r) => r.type === "solo").map((r) => r.id);
  const creatorIds = rows.map((r) => r.creatorId);

  // Four batched queries instead of ~4 per row.
  const [creators, images, stats, soloStats] = await Promise.all([
    getCreatorNames(creatorIds),
    getImagesByLevelId(levelIds),
    getStatsByLevelId(levelIds),
    getSoloStatsByLevelId(soloLevelIds),
  ]);

  return rows.map((row) => {
    const s = stats.get(row.id);
    const solo = soloStats.get(row.id);
    return {
      level_id: row.id,
      level_name: row.name,
      level_max_players: row.maxPlayers,
      level_rating: row.rating,
      level_creator_name: creators.get(row.creatorId) || "Unknown",
      level_json: row.content,
      level_img: images.get(row.id) ?? null,
      level_type: row.type,
      level_status: row.status,
      level_rounds_played: s?.rounds_played || 0,
      level_kills: s?.kills || 0,
      level_deaths: s?.deaths || 0,
      level_wins: s?.wins || 0,
      level_shots: s?.shots || 0,
      level_hits: s?.hits || 0,
      level_plants: s?.plants || 0,
      level_blocks_destroyed: s?.blocks_destroyed || 0,
      // Solo-specific stats
      solo_times_played: solo?.times_played || 0,
      solo_success_rate: solo?.success_rate || 0,
      solo_best_time_ms: solo?.best_time_ms || null,
    };
  });
}

module.exports = {
  parseId,
  getCreatorName,
  getImgFromLevelId,
  formatLevels,
};
