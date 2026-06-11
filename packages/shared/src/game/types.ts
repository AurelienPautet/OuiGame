// Internal geometry + collaborator shapes for the typed game runtime. These are
// intentionally local to the game package (not imported from `../types`) so the
// runtime stays self-contained; they are structurally identical to the wire
// shapes in `@ouigame/shared/types`, so a runtime Block/Bullet/Mine stays
// assignable to the matching DTO at any emit boundary.

/** A 2D point/vector. Keys are load-bearing: `{ x, y }`, never `{ left, top }`. */
export interface Vec2 {
  x: number;
  y: number;
}

/** A box size. Keys are load-bearing: `{ w, h }`, never `{ width, height }`. */
export interface Size {
  w: number;
  h: number;
}

import type { ServerToClientEvents } from "../socket";

// The subset of ServerToClientEvents that the game runtime itself broadcasts
// from inside a Room (via `emit_to_room`). Listing them explicitly turns a
// stray or misspelled event name into a compile error and ties each call to the
// wire payload the socket contract declares. The two remaining room broadcasts
// — `level_change_info` and `countdown_start` — are emitted by the server's
// tick loop through `room.io`, not by the runtime, so they are not listed here
// but are still permitted by RoomEmitter below.
export type RoomBroadcastEvent =
  | "tick"
  | "tick_sounds"
  | "level_change"
  | "winner"
  | "player-kill"
  | "player-disconnection"
  | "player_explosion"
  | "bullet_explosion"
  | "mine_explosion"
  | "shoot_explosion"
  | "ricochet_explosion";

// The minimal Socket.io-ish sink the Room broadcasts through, now typed against
// the wire contract instead of `(string, unknown)`: `emit` accepts any
// server->client event name and exactly the payload `ServerToClientEvents`
// declares for it. Both the server's real Socket.io `Server` and the web
// client's solo `LocalIO` satisfy this shape. The Room only ever calls
// `io.to(id).emit(event, data)`, so that is all we model.
export interface RoomEmitter {
  emit<E extends keyof ServerToClientEvents>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void;
}
export interface RoomIo {
  // Socket.io rooms are string-keyed and players join via
  // `socket.join(String(room.id))`, so the Room broadcasts to `String(id)`.
  // Accept both forms (Socket.io's own `Room` is `string | number`).
  to(target?: number | string): RoomEmitter;
}

// A drawing surface for the optional debug overlays. In the browser this is a
// real CanvasRenderingContext2D; on the server it is simply absent (the bot
// math runs headless), so every draw path is guarded by `if (!ctx) return`.
export type DrawingContext = CanvasRenderingContext2D;
