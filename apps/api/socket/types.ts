// Shared socket.io type aliases for the api: the Server/Socket instances are
// parameterised with the typed event maps from @ouigame/shared/socket, so every
// io.emit / socket.on / socket.emit is checked against the wire contract.
// `socket.data` carries the per-socket flood-guard window (was an ad-hoc
// `socket._rl` property in the JS version).
import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@ouigame/shared/socket";

export interface SocketData {
  rl?: { start: number; count: number };
}

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
