// The global ~60fps game tick: one self-rescheduling setTimeout that advances
// every room and, on a round end, records the round and schedules the respawn +
// countdown. The respawn/countdown timers are tracked per-room (via the
// registry's roomTimers) so they can be cleared if the room is deleted mid-wait.
const { loadlevel } = require("@ouigame/shared/game");
const levelsService = require("../services/levels.service");
const ratingsRepo = require("../repositories/ratings.repo");
const statsRepo = require("../repositories/stats.repo");
const { users } = require("../shared_state");

const waitingtime = 5000; // delay before the room respawns after a round ends

function createTickLoop({ io, rooms, roomTimers }) {
  let oldTime = performance.now();
  function getTimeElapsed() {
    const now = performance.now();
    const res = now - oldTime;
    oldTime = now;
    return res;
  }

  // After a round ends, wait `waitingtime`, then reload the level, broadcast the
  // new level info, respawn, and run a countdown. Tracked so room deletion can
  // cancel it; guarded so a stale fire (room emptied during the wait/awaits)
  // is a no-op.
  function scheduleRespawn(room) {
    const respawn = setTimeout(async () => {
      // Bail if the room was emptied/deleted during the wait.
      if (rooms[room.id] === undefined) return;

      const level_json = await levelsService.getLevelJson(
        room.levels[room.levelid]
      );
      await loadlevel(level_json.data, room);

      // Re-check after the awaits — the room could have emptied meanwhile.
      if (rooms[room.id] === undefined) return;

      levelsService.getLevel(room.levels[room.levelid]).then((level) => {
        room.io.to(room.id).emit("level_change_info", level ? [level] : []);
      });

      room.respawn_the_room();

      // Activate countdown - players can see but not act
      room.countdownActive = true;
      room.io
        .to(room.id)
        .emit("countdown_start", { duration: room.countdownDuration });

      // End countdown after duration
      const countdown = setTimeout(() => {
        room.countdownActive = false;
      }, room.countdownDuration);
      const tracked = roomTimers.get(room.id) || {};
      tracked.countdown = countdown;
      roomTimers.set(room.id, tracked);

      for (const socketid in room.players) {
        if (users[socketid]) {
          const stars = await ratingsRepo.getRating(
            room.levels[room.levelid].id,
            users[socketid].playerId
          );
          io.to(socketid).emit("your_level_rating", stars ? stars : 0);
        }
      }
    }, waitingtime);

    const tracked = roomTimers.get(room.id) || {};
    tracked.respawn = respawn;
    roomTimers.set(room.id, tracked);
  }

  function tick() {
    setTimeout(tick, 16.67);
    const TimeElapsed = getTimeElapsed();
    const fps_corector = TimeElapsed / 16.67;

    for (const room of Object.values(rooms)) {
      if (room.update(fps_corector)) {
        for (const socketid in room.players) {
          const player = room.players[socketid];
          const playerId = users[socketid] ? users[socketid].playerId : null;
          statsRepo.insertRound(
            playerId,
            room.levels[room.levelid],
            player.round_stats.stats
          );
          player.round_stats.reset();
        }

        scheduleRespawn(room);
      }
    }
  }

  function start() {
    setTimeout(tick, 16.67); // 16.67 ms ≈ 60 fps
  }

  return { start };
}

module.exports = { createTickLoop };
