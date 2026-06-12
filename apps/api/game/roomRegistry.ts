// Owns the in-memory `rooms` registry and the per-room pending-timer map, and
// exposes create/list/delete. The SAME `rooms` object reference is shared with
// the HTTP layer via setRoomsRef — so it is only ever MUTATED in place
// (rooms[id] = … / delete rooms[id]), never reassigned.
import { loadlevel, Room } from "@ouigame/shared/game";
import type { RoomMode } from "@ouigame/shared/game";
import type { LobbyState } from "@ouigame/shared/types";
import * as levelsService from "../services/levels.service";
import * as levelsRepo from "../repositories/levels.repo";
import { setRoomsRef } from "../routes/rooms.routes";
import type { AppServer, AppSocket } from "../socket/types";

// Grace period before an emptied room is actually removed (see deleteRoomIfEmpty).
const EMPTY_ROOM_GRACE_MS = 3000;

function createRoomRegistry({
  io,
  serverid,
}: {
  io: AppServer;
  serverid: string;
}) {
  const rooms: Record<number, Room> = {};
  // Per-room pending respawn/countdown timers, keyed by room.id:
  // { respawn: Timeout|null, countdown: Timeout|null }. Tracked so they can be
  // cleared when a room is deleted (otherwise they fire on a dead room).
  const roomTimers = new Map<
    number,
    { respawn?: NodeJS.Timeout; countdown?: NodeJS.Timeout }
  >();

  // Share the SAME object reference with the HTTP routes (load-bearing: the
  // routes read this exact object; never replace it).
  setRoomsRef(rooms);

  // Broadcast the room list. `socket === 0` => broadcast to the whole lobby;
  // otherwise emit to that one socket.
  function room_list(socket: AppSocket | 0) {
    const room_ids = [];
    const room_names = [];
    const room_players = [];
    const room_players_max = [];
    const room_creator_name = [];
    for (const room of Object.values(rooms)) {
      room_ids.push(room.id);
      room_names.push(room.name);
      // Capacity-relevant count: coop rooms gate on humans (level bots don't
      // consume seats); ffa counts every combatant (lobby bots hold real
      // spawn slots).
      room_players.push(
        room.mode === "coop"
          ? room.human_count()
          : Object.keys(room.players).length
      );
      room_players_max.push(room.maxplayernb);
      room_creator_name.push(room.creator);
    }
    if (socket != 0) {
      socket.emit(
        "room_list",
        room_ids,
        room_names,
        room_creator_name,
        room_players,
        room_players_max
      );
    } else {
      io.to("lobby" + serverid).emit(
        "room_list",
        room_ids,
        room_names,
        room_creator_name,
        room_players,
        room_players_max
      );
    }
  }

  // `mode` doubles as the lobby opt-in: when present (every new web client
  // sends it) the room is born held in a pre-game lobby — countdownActive
  // freezes input/sim exactly like the between-rounds wait — until the host's
  // lobby_start. Absent (old clients), the room keeps the historical
  // immediate-play behaviour. Returns the new room id, or { error } when the
  // request is rejected (the handler relays it as room_create_failed).
  async function create_room(
    name: string,
    rounds: number,
    list_id: number[],
    creator: string,
    mode?: RoomMode
  ): Promise<number | { error: string }> {
    if (mode === "coop") {
      // Enabled by the coop PR (playlist validation + bot setup).
      return { error: "coop_unavailable" };
    }
    const room = new Room(name, rounds, list_id, creator, io);
    if (mode !== undefined) {
      room.mode = mode;
      room.status = "lobby";
      room.countdownActive = true; // the indefinite pre-start hold
    }
    room.maxplayernb = (await levelsRepo.getMinMaxPlayers(list_id))
      .min as number;
    // room.levels is the list_id passed above; the entry at levelid (0 on a
    // fresh room) is present whenever the room was created with levels.
    const levelId = room.levels[room.levelid];
    const level_json =
      levelId !== undefined ? await levelsService.getLevelJson(levelId) : null;
    rooms[room.id] = room;
    if (room) {
      // `data` is the JSON level grid (a flat number[] of cell codes); it
      // reaches us as `unknown` off the DB row.
      loadlevel(level_json!.data as number[], room);
    }
    room_list(0);
    console.log("Room created:", room.id, room.name);
    return room.id;
  }

  // One lobby_state snapshot to everyone in the room — on join/leave, host
  // change, bot add/remove and start. Never per tick.
  function broadcast_lobby_state(room: Room) {
    const members: LobbyState["members"] = [];
    for (const socketid of room.ids) {
      const player = room.players[socketid];
      if (!player) continue;
      members.push({
        socketid,
        name: player.name,
        turretc: player.turretc,
        bodyc: player.bodyc,
        is_bot: player.is_bot,
        is_host: socketid === room.hostid,
      });
    }
    const state: LobbyState = {
      room_id: room.id,
      name: room.name,
      status: room.status,
      mode: room.mode,
      max_players: room.maxplayernb,
      members,
    };
    io.to(String(room.id)).emit("lobby_state", state);
  }

  // Clear (and forget) any pending respawn/countdown timers for a room.
  function clearRoomTimers(roomId: number) {
    const t = roomTimers.get(roomId);
    if (t) {
      if (t.respawn) clearTimeout(t.respawn);
      if (t.countdown) clearTimeout(t.countdown);
      roomTimers.delete(roomId);
    }
  }

  // Remove a room from the registry once its last player has left (leak fix:
  // empty rooms used to linger forever and the tick loop kept iterating them).
  // Only ever called from the leave/disconnect path — NEVER right after
  // create_room — so a freshly created (still empty) room is not deleted.
  //
  // Deletion is deferred by a short grace period and re-checks emptiness when it
  // fires, so a player who re-joins in the meantime keeps the room. This covers
  // React StrictMode double-mounting the game view in dev (mount → quit →
  // re-mount would otherwise delete the freshly-created room mid-join, making
  // the re-join id-fail and leaving online play unjoinable) and brief reconnects
  // in prod.
  function deleteRoomIfEmpty(room: Room) {
    // HUMAN-empty, not players-empty: lobby bots stay registered in
    // room.players, so a bots-only room would otherwise survive its last
    // human forever (ticking, listed, undeletable).
    if (room.human_count() !== 0) return;
    setTimeout(() => {
      // Same room object (id not reused) and still human-empty when the timer
      // fires?
      if (rooms[room.id] === room && room.human_count() === 0) {
        clearRoomTimers(room.id);
        delete rooms[room.id];
        room_list(0);
      }
    }, EMPTY_ROOM_GRACE_MS);
  }

  return {
    rooms,
    roomTimers,
    room_list,
    create_room,
    broadcast_lobby_state,
    clearRoomTimers,
    deleteRoomIfEmpty,
  };
}

export { createRoomRegistry };
