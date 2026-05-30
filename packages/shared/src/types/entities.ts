import type { Vector2, Size, StatsCounters } from "./primitives";

// A Stats INSTANCE is serialized over the wire as { stats: StatsCounters } (NOT
// unwrapped). This is distinct from winner.player_scores, which IS the unwrapped
// StatsCounters keyed by socketid.
export interface SerializedStats {
  stats: StatsCounters;
}

// The whole Player instance is serialized as-is in the `tick` payload (Socket.io
// JSON-stringifies it with no toJSON). `socketid` is ONE lowercase word (not
// `socket_id`). `rotation`/`side` are added at runtime by update(), so optional.
//
// Bots (socketid like "bot0") live in the same players map and serialize ALL
// their AI fields too; those extra fields are intentionally NOT modelled here —
// no Phase 1b consumer reads them, and the renderer only reads the subset below.
export interface Player {
  name: string;
  bodyc: string;
  turretc: string;
  position: Vector2;
  socketid: string;
  mytick: number;
  round_stats: SerializedStats;
  spawnpos: Vector2;
  velocity: Vector2;
  size: Size;
  turretsize: Size;
  angle: number;
  endpos: Vector2;
  direction: Vector2;
  bulletcount: number;
  minecount: number;
  aim: Vector2;
  alive: boolean;
  max_bulletcount: number;
  max_minecount: number;
  mvtspeed: number;
  shoot_speed: number;
  shoot_max_bounce: number;
  bullet_size: Size;
  bullet_type: number;
  // Added at runtime: rotation in degrees (0 / 45 / -45 / 90), side from a
  // collision check ("" | "right" | "left" | "up" | "down", or a boolean).
  rotation?: number;
  side?: string | boolean;
}

// `emitter` is a back-reference to the firing player: the FULL Player object is
// embedded (duplicated) in each serialized bullet — the same object that also
// appears in the tick's `players` map. (Not a JSON cycle; Player has no bullet
// back-reference.) The renderer reads position, size, angle, bounce, type.
export interface Bullet {
  type: number;
  velocity: Vector2;
  angle: number;
  size: Size;
  position: Vector2;
  draw_size: Size;
  last_collision_object: unknown | null;
  mytick: number;
  bounce: number;
  max_bounce: number;
  emitter: Player;
  side?: string;
}

export interface Mine {
  position: Vector2;
  radius: number;
  timealive: number;
  color: string;
  emitter: Player;
}

// type 1 = wall (breakable), type 2 = destructible (only type 2 is destroyed by
// a mine).
export interface Block {
  position: Vector2;
  size: Size;
  type: number;
}

// No `type` field.
export interface Hole {
  position: Vector2;
  size: Size;
}

// The class name "CollisonsBox" is MISSPELLED in the codebase (missing the "i").
// Preserved verbatim; the wire array key is "Bcollision" (capital B).
export interface CollisonsBox {
  position: Vector2;
  size: Size;
}
