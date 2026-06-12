// The global ~60fps game tick: one self-rescheduling setTimeout that advances
// every room and, on a round end, records the round and schedules the respawn +
// countdown. The respawn/countdown timers are tracked per-room (via the
// registry's roomTimers) so they can be cleared if the room is deleted mid-wait.
import {
  loadlevel,
  SIM_STEP_S,
  SIM_STEP_MS,
  MAX_SUBSTEPS,
  MAX_FRAME_MS,
} from "@ouigame/shared/game";
import type { Room } from "@ouigame/shared/game";
import * as levelsService from "../services/levels.service";
import * as ratingsRepo from "../repositories/ratings.repo";
import * as statsRepo from "../repositories/stats.repo";
import * as achievementsService from "../services/achievements.service";
import { beginCountdown } from "./countdown";
import { users } from "../shared_state";
import type { AppServer } from "../socket/types";
import type { RoundStats } from "@ouigame/shared/api";

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
      // `data` is the JSON level grid (a flat number[] of cell codes), typed
      // `unknown` off the DB row.
      await loadlevel(level_json!.data as number[], room);

      // Re-check after the awaits — the room could have emptied meanwhile.
      if (rooms[room.id] === undefined) return;

      levelsService.getLevel(levelId).then((level) => {
        // Server rooms are always constructed with a real io (only solo/web
        // rooms pass null), so the broadcast handle is present here. Socket.io
        // rooms are STRING-keyed — the numeric id targeted an empty channel.
        room
          .io!.to(String(room.id))
          .emit("level_change_info", level ? [level] : []);
      });

      if (room.mode === "coop") {
        // Last round's bot roster leaves before anyone respawns: a level
        // bot's slot came from botN_spawns (never returned to the player
        // pool), and respawn_the_room would otherwise re-deal dead bots onto
        // PLAYER spawns. Quiet removal — no disconnect toasts. The ids array
        // is snapshotted because removal splices it.
        for (const id of [...room.ids]) {
          if (room.players[id]?.is_bot) room.remove_player_quiet(id, false);
        }
        // loadlevel above refilled the (typically single-spawn) player pool;
        // grow it so every human — including joiners who waited out the
        // round — gets a deterministic slot near the authored spawn. Every
        // human is about to be re-dealt, so their (previous-level) spawnpos
        // cells must NOT be reserved against the fresh grid.
        room.ensure_spawn_capacity(room.human_count(), false);
      }

      room.respawn_the_room();

      if (room.mode === "coop") {
        // Fresh bots from the level's just-reloaded spawn cells, AFTER the
        // humans took their player slots (nbliving accounts both groups).
        room.spawn_all_bots();
      }

      // Freeze, announce and time the 3-2-1 (shared with the lobby's Start).
      beginCountdown(room, roomTimers);

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

  // Fixed-timestep accumulator. The setTimeout is just a ~60 Hz wake-up clock;
  // the actual simulation always advances in whole SIM_STEP_S slices, so game
  // speed is independent of how punctual the timer is. Real elapsed time is
  // banked in `accumulator` and drained one fixed step at a time. A long stall
  // (clamped to MAX_FRAME_MS, then capped at MAX_SUBSTEPS catch-up steps) drops
  // its backlog instead of fast-forwarding — the "spiral of death" guard.
  let accumulator = 0;

  // Persist one online round, then (for logged-in players) evaluate achievements
  // and push any new unlocks to that player's socket. Internally sequential
  // (insert → aggregate-includes-this-round → unlock) but fired WITHOUT awaiting
  // so it never blocks the tick. `stats` is a snapshot taken before reset().
  async function recordOnlineRound(
    socketid: string,
    playerId: number | null,
    levelId: number,
    stats: RoundStats
  ) {
    await statsRepo.insertRound(playerId, levelId, stats);
    if (playerId === null) return;
    const unlocked = await achievementsService.evaluateOnlineRound(
      playerId,
      stats
    );
    if (unlocked.length > 0) {
      io.to(socketid).emit("achievements_unlocked", unlocked);
    }
  }

  function stepAllRooms() {
    for (const room of Object.values(rooms)) {
      if (room.update(SIM_STEP_S)) {
        // room.levels holds level IDs; the current entry is present for a live
        // room. Guard so a malformed/empty list skips the round insert.
        const levelId = room.levels[room.levelid];
        for (const socketid in room.players) {
          const player = room.players[socketid];
          if (player === undefined || levelId === undefined) continue;
          // Bots have no account and no meaningful per-round row (they would
          // insert as anonymous junk); a waiting coop joiner sat the round
          // out, so recording their zeroed stats would skew averages. Their
          // stats still reset — a persistent FFA lobby bot would otherwise
          // accumulate kills/wins across rounds on every scoreboard.
          if (player.is_bot || player.pending_spawn) {
            player.round_stats.reset();
            continue;
          }
          const user = users[socketid];
          const playerId = user ? user.playerId : null;
          // Snapshot the stats before reset so the async recorder reads the
          // round's final values, not a freshly-zeroed object.
          const stats: RoundStats = { ...player.round_stats.stats };
          player.round_stats.reset();
          // Fire-and-forget so the tick never blocks; the .catch keeps a
          // transient DB error (during insert or achievement eval) from
          // surfacing as an unhandled rejection.
          void recordOnlineRound(socketid, playerId, levelId, stats).catch(
            (err) => console.error("recordOnlineRound failed:", err)
          );
        }

        scheduleRespawn(room);
      }
    }
  }

  function tick() {
    setTimeout(tick, SIM_STEP_MS);
    accumulator += Math.min(getTimeElapsed(), MAX_FRAME_MS);

    let steps = 0;
    while (accumulator >= SIM_STEP_MS && steps < MAX_SUBSTEPS) {
      stepAllRooms();
      accumulator -= SIM_STEP_MS;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) accumulator = 0; // drop the backlog
  }

  function start() {
    setTimeout(tick, SIM_STEP_MS); // ~60 fps wake-up clock
  }

  return { start };
}

export { createTickLoop };
