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

// The minimal Socket.io-ish sink the Room broadcasts through. Both the server's
// real Socket.io `Server` and the web client's solo `LocalIO` satisfy it. The
// Room only ever calls `io.to(id).emit(event, data)`, so that is all we model.
export interface RoomEmitter {
  emit(event: string, data: unknown): void;
}
export interface RoomIo {
  to(target?: number): RoomEmitter;
}

// A drawing surface for the optional debug overlays. In the browser this is a
// real CanvasRenderingContext2D; on the server it is simply absent (the bot
// math runs headless), so every draw path is guarded by `if (!ctx) return`.
export type DrawingContext = CanvasRenderingContext2D;
