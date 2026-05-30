// The global ~60fps game tick: one self-rescheduling setTimeout that advances
// every room and, on a round end, records the round and schedules the respawn +
// countdown. The respawn/countdown timers are tracked per-room (via the
// registry's roomTimers) so they can be cleared if the room is deleted mid-wait.
import { loadlevel } from "@ouigame/shared/game";
import type { Room } from "@ouigame/shared/game";
import * as levelsService from "../services/levels.service";
import * as ratingsRepo from "../repositories/ratings.repo";
import * as statsRepo from "../repositories/stats.repo";
import { users } from "../shared_state";
import type { AppServer } from "../socket/types";

const waitingtime = 5000; // delay before the room respawns after a round ends

function createTickLoop({
  io,
  rooms,
  roomTimers,
}: {
  io: AppServer;
  rooms: Record<number, Room>;
  roomTimers: Map<
    number,
    { respawn?: NodeJS.Timeout; countdown?: NodeJS.Timeout }
  >;
}) {
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
  function scheduleRespawn(room: Room) {
    const respawn = setTimeout(async () => {
      // Bail if the room was emptied/deleted during the wait.
      if (rooms[room.id] === undefined) return;

      // room.levels holds level IDs; the entry at the current index is always
      // present for a live room, but guard so a malformed/empty list is a no-op.
      const levelId = room.levels[room.levelid];
      if (levelId === undefined) return;

      const level_json = await levelsService.getLevelJson(levelId);
      await loadlevel(level_json!.data, room);

      // Re-check after the awaits — the room could have emptied meanwhile.
      if (rooms[room.id] === undefined) return;

      levelsService.getLevel(levelId).then((level) => {
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
        const user = users[socketid];
        if (user) {
          // room.levels holds level IDs directly; pass it as-is (matching the
          // `play` handler) so getRating receives the real id.
          const stars = await ratingsRepo.getRating(levelId, user.playerId);
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
        // room.levels holds level IDs; the current entry is present for a live
        // room. Guard so a malformed/empty list skips the round insert.
        const levelId = room.levels[room.levelid];
        for (const socketid in room.players) {
          const player = room.players[socketid];
          if (player === undefined || levelId === undefined) continue;
          const user = users[socketid];
          const playerId = user ? user.playerId : null;
          statsRepo.insertRound(playerId, levelId, player.round_stats.stats);
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

export { createTickLoop };
