import type { AppSocket, AppServer } from "./types";
import { users } from "../shared_state";
import type {
  AdminConnectedPlayer,
  AdminConnectedPlayersResponse,
} from "@ouigame/shared/api";

export interface TrackedSocket {
  socketId: string;
  clientId: string;
  connectedAt: number;
  ip: string;
  guestName?: string | undefined;
}

interface RoomPlayerLike {
  name?: string;
}

interface RoomLike {
  id: number;
  name: string;
  mode?: string;
  status?: string;
  players?: Record<string, RoomPlayerLike>;
}

const trackedSockets = new Map<string, TrackedSocket>();
let roomsRef: Record<number, RoomLike> = {};
let ioRef: AppServer | null = null;

export function setConnectedRoomsRef(rooms: Record<number, unknown>) {
  roomsRef = rooms as Record<number, RoomLike>;
}

export function setConnectedIoRef(io: AppServer | null) {
  ioRef = io;
}

function extractIp(socket: AppSocket): string {
  const headers = socket.handshake.headers;
  const forwarded = headers ? headers["x-forwarded-for"] : undefined;
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0];
    return first ? first.trim() : "127.0.0.1";
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0];
    return first ? first.trim() : "127.0.0.1";
  }
  return socket.handshake.address || "127.0.0.1";
}

export function trackSocketConnect(socket: AppSocket) {
  const authClientId = socket.handshake.auth?.clientId;
  const clientId =
    typeof authClientId === "string" && authClientId.trim().length > 0
      ? authClientId.trim().slice(0, 64)
      : socket.id;

  const authPlayerName = (
    socket.handshake.auth as Record<string, unknown> | undefined
  )?.playerName;
  const guestName =
    typeof authPlayerName === "string" && authPlayerName.trim().length > 0
      ? authPlayerName.trim().slice(0, 30)
      : undefined;

  const connectedAt = socket.data.connectedAt ?? Date.now();
  socket.data.connectedAt = connectedAt;
  if (guestName && !socket.data.guestName) {
    socket.data.guestName = guestName;
  }

  trackedSockets.set(socket.id, {
    socketId: socket.id,
    clientId,
    connectedAt,
    ip: extractIp(socket),
    guestName: socket.data.guestName ?? guestName ?? undefined,
  });
}

export function updateSocketGuestName(socketId: string, guestName: string) {
  const trimmed = guestName.trim().slice(0, 30);
  const entry = trackedSockets.get(socketId);
  if (entry) {
    entry.guestName = trimmed;
  }
}

export function trackSocketDisconnect(socketId: string) {
  trackedSockets.delete(socketId);
}

export function getConnectedPlayers(): AdminConnectedPlayersResponse {
  const now = Date.now();
  const playerList: AdminConnectedPlayer[] = [];

  // Determine active socket entries
  const activeEntries: TrackedSocket[] = [];

  if (ioRef?.sockets?.sockets) {
    for (const [socketId, socket] of ioRef.sockets.sockets) {
      let entry = trackedSockets.get(socketId);
      if (!entry) {
        entry = {
          socketId,
          clientId: socket.data.clientId || socket.id,
          connectedAt: socket.data.connectedAt ?? Date.now(),
          ip: extractIp(socket),
          guestName: socket.data.guestName ?? undefined,
        };
        trackedSockets.set(socketId, entry);
      }
      activeEntries.push(entry);
    }
  } else {
    for (const entry of trackedSockets.values()) {
      if (entry) {
        activeEntries.push(entry);
      }
    }
  }

  for (const entry of activeEntries) {
    const user = users[entry.socketId];
    const isRegistered = user !== undefined;

    let inRoom: {
      id: number;
      name: string;
      mode?: string;
      status?: string;
    } | null = null;
    let roomPlayerName: string | undefined;

    if (roomsRef) {
      for (const room of Object.values(roomsRef)) {
        if (!room) continue;
        if (room.players && room.players[entry.socketId]) {
          inRoom = {
            id: room.id,
            name: room.name,
            ...(room.mode !== undefined ? { mode: room.mode } : {}),
            ...(room.status !== undefined ? { status: room.status } : {}),
          };
          roomPlayerName = room.players[entry.socketId]?.name;
          break;
        }
      }
    }

    const status: "lobby" | "playing" | "in_room" = inRoom
      ? inRoom.status === "playing"
        ? "playing"
        : "in_room"
      : "lobby";

    const durationMs = Math.max(0, now - entry.connectedAt);

    playerList.push({
      socketId: entry.socketId,
      clientId: entry.clientId,
      type: isRegistered ? "registered" : "guest",
      connectedAt: new Date(entry.connectedAt).toISOString(),
      durationMs,
      ip: entry.ip,
      status,
      room: inRoom,
      user: isRegistered
        ? {
            id: user.playerId,
            username: user.username,
            email: user.email,
            isAdmin: Boolean(user.isAdmin),
          }
        : null,
      guestName: isRegistered
        ? null
        : entry.guestName || roomPlayerName || null,
    });
  }

  // Sort by connectedAt descending (most recently connected first)
  playerList.sort(
    (a, b) =>
      new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime()
  );

  const registeredCount = playerList.filter(
    (p) => p.type === "registered"
  ).length;
  const guestCount = playerList.filter((p) => p.type === "guest").length;

  return {
    total: playerList.length,
    registeredCount,
    guestCount,
    players: playerList,
  };
}

export function getConnectedCounts(): {
  total: number;
  registered: number;
  guests: number;
} {
  const result = getConnectedPlayers();
  return {
    total: result.total,
    registered: result.registeredCount,
    guests: result.guestCount,
  };
}

export function __setTrackedSocketsForTest(sockets: TrackedSocket[]) {
  trackedSockets.clear();
  for (const s of sockets) {
    trackedSockets.set(s.socketId, s);
  }
}

export function __resetForTests() {
  trackedSockets.clear();
  roomsRef = {};
  ioRef = null;
}
