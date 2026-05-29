const path = require("path");
const { db, schema } = require(path.join(__dirname, "..", "db"));
const { rounds } = schema;
const { eq, sum, count } = require("drizzle-orm");
const { users } = require(path.join(__dirname, "..", "shared_state.js"));

async function add_round(player_socket_id, level_id, stats_to_add) {
  try {
    let player_id = null;
    if (player_socket_id !== null && users[player_socket_id]) {
      player_id = users[player_socket_id].id;
    }

    await db.insert(rounds).values({
      playerId: player_id,
      levelId: level_id,
      kills: stats_to_add.kills,
      deaths: stats_to_add.deaths,
      wins: stats_to_add.wins,
      shots: stats_to_add.shots,
      hits: stats_to_add.hits,
      plants: stats_to_add.plants,
      blocksDestroyed: stats_to_add.blocks_destroyed,
    });
  } catch (err) {
    console.error("Error adding round:", err);
  }
}

async function get_user_stats(player_socket_id, socket) {
  try {
    const player_id = users[player_socket_id].id;

    const res = await db
      .select({
        kills: sum(rounds.kills),
        deaths: sum(rounds.deaths),
        wins: sum(rounds.wins),
        shots: sum(rounds.shots),
        hits: sum(rounds.hits),
        plants: sum(rounds.plants),
        blocks_destroyed: sum(rounds.blocksDestroyed),
        rounds_played: count(rounds.id),
      })
      .from(rounds)
      .where(eq(rounds.playerId, player_id));

    if (res.length > 0) {
      socket.emit("player_stats", res[0]);
    } else {
      socket.emit("player_stats", null);
    }
  } catch (err) {
    console.error("Error getting user stats:", err);
    socket.emit("player_stats", null);
  }
}

module.exports = {
  add_round,
  get_user_stats,
};
