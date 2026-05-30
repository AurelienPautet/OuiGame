// The gameplay socket layer: the io.on("connect") handler plus the auth, play,
// tock, quit and disconnect logic. State (io, serverid, the rooms registry +
// its room_list/create_room/deleteRoomIfEmpty) is injected from the composition
// root so there are no import cycles.
import { verifySession } from "../auth/session";
import * as levelsService from "../services/levels.service";
import * as ratingsRepo from "../repositories/ratings.repo";
import { users } from "../shared_state";
import type { Room } from "@ouigame/shared/game";
import type { Block, CollisonsBox } from "@ouigame/shared/types";
import type { AppServer, AppSocket } from "./types";

// {x, y} with finite numeric components.
function isVector(v: unknown): v is { x: number; y: number } {
  return (
    v != null &&
    typeof v === "object" &&
    Number.isFinite((v as { x: unknown }).x) &&
    Number.isFinite((v as { y: unknown }).y)
  );
}

// Lightweight per-socket flood guard. Normal play sends ~60 tock/s; anything
// past MAX_EVENTS_PER_WINDOW is dropped to blunt event spam.
const MAX_EVENTS_PER_WINDOW = 150;
const RATE_WINDOW_MS = 1000;
function isFlooding(socket: AppSocket) {
  const now = performance.now();
  if (!socket.data.rl || now - socket.data.rl.start > RATE_WINDOW_MS) {
    socket.data.rl = { start: now, count: 0 };
  }
  socket.data.rl.count += 1;
  return socket.data.rl.count > MAX_EVENTS_PER_WINDOW;
}

function registerSocketHandlers({
  io,
  serverid,
  rooms,
  room_list,
  create_room,
  deleteRoomIfEmpty,
}: {
  io: AppServer;
  serverid: string;
  rooms: Record<number, Room>;
  room_list: (socket: AppSocket | 0) => void;
  create_room: (
    name: string,
    rounds: number,
    list_id: number[],
    creator: string
  ) => Promise<number>;
  deleteRoomIfEmpty: (room: Room) => void;
}) {
  // Resolve a session token to an in-memory user record keyed by socket id.
  async function authenticateSocket(socket: AppSocket, token: string) {
    try {
      const user = await verifySession(token);
      if (user) {
        users[socket.id] = {
          playerId: user.playerId,
          username: user.username,
          email: user.email,
        };
        return true;
      }
    } catch (err) {
      console.error("Socket auth error:", err);
    }
    delete users[socket.id];
    return false;
  }

  // Leave the game room without logging out - called on quit and disconnect.
  function leave_game(socket: AppSocket) {
    try {
      for (const r of Object.values(rooms)) {
        socket.leave(String(r.id));
        r.delete_player(socket.id);
        deleteRoomIfEmpty(r); // remove the room once its last player has left
      }
    } catch (error) {
      console.error("Error handling player leaving game:", error);
    }
    room_list(0);
  }

  function disconnect_socket(socket: AppSocket) {
    console.log(socket.id, "Got disconnect!");
    // Drop the in-memory auth record for this socket. The persisted session
    // (HTTP) stays valid so the user remains logged in across reconnects.
    delete users[socket.id];
    // Also leave game room
    leave_game(socket);
  }

  io.on("connect", (socket: AppSocket) => {
    room_list(socket);
    socket.join("lobby" + serverid);

    // Authenticate from the token supplied in the handshake (set on initial
    // connect and on every reconnect). This populates `users[socket.id]` so
    // gameplay stats and level ratings are attributed to the logged-in player.
    if (socket.handshake.auth?.token) {
      authenticateSocket(socket, socket.handshake.auth.token);
    }

    // Re-authenticate when the user logs in/out without reconnecting.
    socket.on("authenticate", async (token) => {
      const ok = await authenticateSocket(socket, token);
      socket.emit("authenticated", ok);
    });
    socket.on("deauthenticate", () => {
      delete users[socket.id];
    });

    socket.emit("welcome", socket.id + "has joinded the server");
    socket.emit("serverid", serverid);
    socket.emit("socketid", socket.id);

    socket.on("disconnect", function () {
      disconnect_socket(socket);
    });

    socket.on("get_json_from_id", (level_id) => {
      levelsService
        .getLevelJson(level_id as number)
        .then((json) => {
          if (json === null) {
            socket.emit("error_getting_json", "Failed to retrieve level data.");
            return;
          }
          socket.emit("recieve_json_from_id", json);
        })
        .catch((error) => {
          console.error("Error getting JSON from ID:", error);
          socket.emit("error_getting_json", "Failed to retrieve level data.");
        });
    });

    socket.on("new-room", async (name, rounds, list_id, creator) => {
      const room_id = await create_room(name, 10, list_id, creator);
      socket.emit("room_created", room_id);
    });

    socket.on("quit", () => {
      // Just leave the game room, don't logout - user stays authenticated
      leave_game(socket);
      socket.join("lobby" + serverid);
    });

    socket.on("play", (playerName, turretc, bodyc, room_id) => {
      // room_id arrives as a number or its string form; the rooms registry is
      // keyed by numeric id, so normalize before the lookup.
      const room = rooms[Number(room_id)];
      if (room == undefined) {
        socket.emit("id-fail");
        return;
      }
      if (
        room.ids.includes(socket.id) == false &&
        Object.keys(room.players).length < room.maxplayernb
      ) {
        room.spawn_new_player(playerName, turretc, bodyc, socket.id);
        socket.emit("id", room.id, room.ids.length - 1, socket.id);
        socket.leave("lobby" + serverid);
        socket.join(String(room.id));
        io.to(String(room.id)).emit("player-connection", playerName);
        // level_change_info is emitted as an ARRAY (the client reads levels[0]),
        // exactly as the old format_and_send_levels did — [] when missing.
        levelsService.getLevel(room.levels[room.levelid]).then((level) => {
          socket.emit("level_change_info", level ? [level] : []);
        });

        // Send user's current rating for this level
        if (users[socket.id]) {
          ratingsRepo
            .getRating(
              room.levels[room.levelid], // room.levels holds level IDs
              users[socket.id].playerId
            )
            .then((stars) => {
              socket.emit("your_level_rating", stars ? stars : 0);
            });
        }

        socket.emit("level_change", {
          // room.blocks / room.Bcollision are opaque (`unknown`) on the ambient
          // Room handle; narrow to the wire DTO shapes at the emit boundary.
          blocks: room.blocks as Block[],
          Bcollision: room.Bcollision as CollisonsBox[],
          level_id: room.levels[room.levelid],
        });
        room_list(0);
      } else {
        socket.emit("id-fail");
      }
    });

    socket.on("tock", (data) => {
      if (isFlooding(socket)) return;
      if (!data || typeof data !== "object") return;

      // Compare (not assign) the server id, and only ever act on the player that
      // belongs to *this* socket — never a socket-id supplied in the payload.
      if (data.serverid !== serverid) {
        socket.emit("wrongserver");
        return;
      }

      // data.room_id may be a number, its string form, or null; the registry is
      // keyed by numeric id (Number(null) === 0 simply misses, as before).
      const room = rooms[Number(data.room_id)];
      const player = room?.players?.[socket.id];
      if (!player || player.position == undefined) return;
      if (room.countdownActive) return; // can see, but not act, during countdown

      if (Number.isFinite(data.mytick)) player.mytick = data.mytick;
      if (isVector(data.direction)) player.direction = data.direction;
      if (isVector(data.aim)) player.aim = data.aim;
      if (data.click) player.shoot(room);
      if (data.plant) player.plant(room);
    });
  });
}

export { registerSocketHandlers };
