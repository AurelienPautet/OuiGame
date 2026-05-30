console.log(__dirname, "db_levels_ratings.js loaded");
const path = require("path");
const { db, schema } = require("@ouigame/db");
const { ratings } = schema;
const { eq, and } = require("drizzle-orm");
const { users } = require(path.join(__dirname, "..", "shared_state.js"));

async function get_level_rating_from_player(level_id, player_id) {
  try {
    const res = await db
      .select({ stars: ratings.stars })
      .from(ratings)
      .where(
        and(eq(ratings.levelId, level_id), eq(ratings.playerId, player_id))
      );

    return res.length > 0 ? res[0].stars : false;
  } catch (err) {
    console.error("Error executing query get_level_rating_from_player:", err);
    return false;
  }
}

async function rate_lvl(rate, level_id, socket) {
  console.log(
    "rate_lvl called - socket.id:",
    socket.id,
    "rate:",
    rate,
    "level_id:",
    level_id
  );
  console.log("users[socket.id]:", users[socket.id]);

  // Check if user is logged in
  if (!users[socket.id]) {
    console.log("rate_lvl FAILED - user not in users object");
    socket.emit("rate_fail", "not logged in");
    return false;
  }

  try {
    const player_id = users[socket.id].id;

    // Check if rating exists
    const existing = await db
      .select()
      .from(ratings)
      .where(
        and(eq(ratings.playerId, player_id), eq(ratings.levelId, level_id))
      );

    if (existing.length === 0) {
      // Insert new rating
      await db.insert(ratings).values({
        playerId: player_id,
        levelId: level_id,
        stars: rate,
      });
    } else {
      // Update existing rating
      await db
        .update(ratings)
        .set({ stars: rate })
        .where(
          and(eq(ratings.playerId, player_id), eq(ratings.levelId, level_id))
        );
    }

    socket.emit("rate_success", rate, level_id);
    return true;
  } catch (err) {
    console.error("rate_lvl error:", err);
    socket.emit("rate_fail", "problem with database");
    return false;
  }
}

module.exports = {
  get_level_rating_from_player,
  rate_lvl,
};
