// Owns the in-memory `rooms` registry and the per-room pending-timer map, and
// exposes create/list/delete. The SAME `rooms` object reference is shared with
// the HTTP layer via setRoomsRef — so it is only ever MUTATED in place
// (rooms[id] = … / delete rooms[id]), never reassigned.
import { loadlevel, Room } from "@ouigame/shared/game";
import * as levelsService from "../services/levels.service";
import * as levelsRepo from "../repositories/levels.repo";
import { setRoomsRef } from "../routes/rooms.routes";
import type { AppServer, AppSocket } from "../socket/types";

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
      room_players.push(Object.keys(room.players).length);
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

  async function create_room(
    name: string,
    rounds: number,
    list_id: number[],
    creator: string
  ) {
    const room = new Room(name, rounds, list_id, creator, io);
    room.maxplayernb = (await levelsRepo.getMinMaxPlayers(list_id))
      .min as number;
    const level_json = await levelsService.getLevelJson(
      room.levels[room.levelid]
    );
    rooms[room.id] = room;
    if (room) {
      loadlevel(level_json!.data, room);
    }
    room_list(0);
    console.log("Room created:", room.id, room.name);
    return room.id;
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
  function deleteRoomIfEmpty(room: Room) {
    if (Object.keys(room.players).length === 0) {
      clearRoomTimers(room.id);
      delete rooms[room.id];
    }
  }

  return {
    rooms,
    roomTimers,
    room_list,
    create_room,
    clearRoomTimers,
    deleteRoomIfEmpty,
  };
}

export { createRoomRegistry };
