const path = require("path");
const { db, schema } = require(path.join(__dirname, "..", "db"));
const { levels, levelsImg } = schema;
const { ratings, rounds } = schema;
const { players } = schema;
const {
  eq,
  like,
  and,
  sql,
  avg,
  count,
  sum,
  min,
  desc,
  inArray,
} = require("drizzle-orm");
const { users } = require(path.join(__dirname, "..", "shared_state.js"));

async function get_levels(input_name, imput_nb_players, type, socket) {
  try {
    let query = db
      .select({
        id: levels.id,
        name: levels.name,
        content: levels.content,
        creatorId: levels.creatorId,
        maxPlayers: levels.maxPlayers,
        type: levels.type,
        status: levels.status,
        rating: sql`COALESCE(AVG(${ratings.stars}), 0)`.as("rating"),
      })
      .from(levels)
      .leftJoin(ratings, eq(levels.id, ratings.levelId))
      .where(
        and(
          like(levels.name, sql`'%' || ${input_name} || '%'`),
          eq(levels.type, type),
          eq(levels.status, "up"),
          imput_nb_players !== 0
            ? eq(levels.maxPlayers, imput_nb_players)
            : undefined,
        ),
      )
      .groupBy(levels.id)
      .orderBy(desc(sql`rating`));

    const rows = await query;
    await format_and_send_levels(rows, socket, "recieve_levels");
  } catch (err) {
    console.error("Error executing query get_levels:", err);
  }
}

async function get_my_levels(input_name, imput_nb_players, socket) {
  let player_id;
  if (!users[socket.id]) {
    player_id = -1;
  } else {
    player_id = users[socket.id].id;
  }

  try {
    let query = db
      .select({
        id: levels.id,
        name: levels.name,
        content: levels.content,
        creatorId: levels.creatorId,
        maxPlayers: levels.maxPlayers,
        rating: sql`COALESCE(AVG(${ratings.stars}), 0)`.as("rating"),
      })
      .from(levels)
      .leftJoin(ratings, eq(levels.id, ratings.levelId))
      .where(
        and(
          like(levels.name, sql`'%' || ${input_name} || '%'`),
          eq(levels.creatorId, player_id),
          eq(levels.status, "up"),
          imput_nb_players !== 0
            ? eq(levels.maxPlayers, imput_nb_players)
            : undefined,
        ),
      )
      .groupBy(levels.id)
      .orderBy(sql`rating`);

    const rows = await query;
    await format_and_send_levels(rows, socket, "recieve_my_levels");
  } catch (err) {
    console.error("Error executing query get_my_levels:", err);
  }
}

async function get_level_from_id(level_id, socket, response_event) {
  try {
    const rows = await db
      .select({
        id: levels.id,
        name: levels.name,
        content: levels.content,
        creatorId: levels.creatorId,
        maxPlayers: levels.maxPlayers,
        type: levels.type,
        rating: sql`COALESCE(AVG(${ratings.stars}), 0)`.as("rating"),
      })
      .from(levels)
      .leftJoin(ratings, eq(levels.id, ratings.levelId))
      .where(eq(levels.id, level_id))
      .groupBy(levels.id);

    await format_and_send_levels(rows, socket, response_event);
    return rows;
  } catch (err) {
    console.error("Error executing query get_level_from_id:", err);
    return "Error";
  }
}

async function save_level(
  level_id,
  levelData,
  hexData,
  level_name,
  max_players,
  type,
  socket,
) {
  if (!users[socket.id]) {
    console.log("User not logged in, cannot save level");
    socket.emit("save_level_fail", "You must be logged in to save a level");
    return;
  }
  const player_id = users[socket.id].id;

  try {
    if (level_id !== -1) {
      // Check ownership
      const existing = await db
        .select()
        .from(levels)
        .where(and(eq(levels.id, level_id), eq(levels.creatorId, player_id)));

      if (existing.length === 0) {
        socket.emit("save_level_fail", "not your level");
        return;
      }

      // Update level
      await db
        .update(levels)
        .set({
          name: level_name,
          content: levelData,
          maxPlayers: max_players,
          type: type,
          status: "up",
        })
        .where(and(eq(levels.id, level_id), eq(levels.creatorId, player_id)));

      // Update image
      await db
        .update(levelsImg)
        .set({ img: Buffer.from(hexData, "hex") })
        .where(eq(levelsImg.levelId, level_id));

      socket.emit("save_level_success", level_id);
    } else {
      // Insert new level
      const result = await db
        .insert(levels)
        .values({
          name: level_name,
          content: levelData,
          creatorId: player_id,
          maxPlayers: max_players,
          type: type,
          status: "up",
        })
        .returning({ id: levels.id });

      const newLevelId = result[0].id;

      // Insert image
      await db.insert(levelsImg).values({
        levelId: newLevelId,
        img: Buffer.from(hexData, "hex"),
      });

      socket.emit("save_level_success", newLevelId);
    }
  } catch (err) {
    console.error("Error executing query save_level:", err);
    socket.emit("save_level_fail", "problem with database");
  }
}

async function get_max_players(list_id) {
  const res = await db
    .select({ min: min(levels.maxPlayers) })
    .from(levels)
    .where(inArray(levels.id, list_id));

  return res[0]?.min;
}

async function get_creator_name(creator_id) {
  const res = await db
    .select({ username: players.username })
    .from(players)
    .where(eq(players.id, creator_id));

  return res.length > 0 ? res[0].username : "Unknown";
}

async function format_and_send_levels(rows, socket, response_event) {
  if (rows.length === 0) {
    socket.emit(response_event, []);
    return [];
  }

  const levelIds = rows.map((r) => r.id);
  const creatorIds = [
    ...new Set(rows.map((r) => r.creatorId).filter((id) => id != null)),
  ];

  // Batched lookups instead of one round-trip per level (was N+1).
  const [creatorRows, imgRows, statRows] = await Promise.all([
    creatorIds.length
      ? db
          .select({ id: players.id, username: players.username })
          .from(players)
          .where(inArray(players.id, creatorIds))
      : [],
    db
      .select({ levelId: levelsImg.levelId, img: levelsImg.img })
      .from(levelsImg)
      .where(inArray(levelsImg.levelId, levelIds)),
    db
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
      .groupBy(rounds.levelId),
  ]);

  const creators = new Map(creatorRows.map((r) => [r.id, r.username]));
  const images = new Map(
    imgRows.map((r) => [r.levelId, r.img ? r.img.toString("hex") : null]),
  );
  const statsByLevel = new Map(statRows.map((r) => [r.levelId, r]));

  const levelsResult = rows.map((row) => {
    const stats = statsByLevel.get(row.id);
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
      level_rounds_played: stats ? stats.rounds_played : 0,
      level_kills: stats ? stats.kills : 0,
      level_deaths: stats ? stats.deaths : 0,
      level_wins: stats ? stats.wins : 0,
      level_shots: stats ? stats.shots : 0,
      level_hits: stats ? stats.hits : 0,
      level_plants: stats ? stats.plants : 0,
      level_blocks_destroyed: stats ? stats.blocks_destroyed : 0,
    };
  });

  socket.emit(response_event, levelsResult);
  return levelsResult;
}

async function get_statsfrom_level_id(level_id) {
  try {
    const res = await db
      .select({
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
      .where(eq(rounds.levelId, level_id));

    return res.length > 0 ? res[0] : null;
  } catch (err) {
    console.error("Error executing query get_statsfrom_level_id:", err);
    return null;
  }
}

async function get_img_from_level_id(level_id) {
  try {
    const res = await db
      .select({ img: levelsImg.img })
      .from(levelsImg)
      .where(eq(levelsImg.levelId, level_id));

    if (res.length === 0) return null;
    return res[0].img.toString("hex");
  } catch (err) {
    console.error("Error executing query get_img_from_level_id:", err);
    return null;
  }
}

async function get_json_from_id(level_id) {
  try {
    const res = await db
      .select({
        id: levels.id,
        name: levels.name,
        content: levels.content,
        creatorId: levels.creatorId,
      })
      .from(levels)
      .where(eq(levels.id, level_id));

    if (res.length === 0) return null;

    const row = res[0];
    const creatorName = await get_creator_name(row.creatorId);
    const img = await get_img_from_level_id(level_id);

    return {
      data: row.content.data,
      level_name: row.name,
      level_creator_name: creatorName,
      level_img: img,
    };
  } catch (err) {
    console.error("Error in get_json_from_id:", err);
    return null;
  }
}

module.exports = {
  get_levels,
  get_my_levels,
  get_level_from_id,
  save_level,
  get_max_players,
  get_creator_name,
  fetch_levels: format_and_send_levels,
  get_statsfrom_level_id,
  get_img_from_level_id,
  get_json_from_id,
};
