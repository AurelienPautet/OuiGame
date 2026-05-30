import type { Vector2, StatsCounters } from "./primitives";
import type {
  Player,
  Bullet,
  Mine,
  Hole,
  Block,
  CollisonsBox,
} from "./entities";

// The `tick` payload — full instance serialization, emitted every Room.update()
// (~60fps). `players` is a MAP (Record), NOT an array. `name` is present but
// ignored by the web client.
export interface RoomSnapshot {
  players: Record<string, Player>;
  bullets: Bullet[];
  mines: Mine[];
  name: string;
  holes: Hole[];
  tick: number;
}

// The `tick_sounds` payload — per-tick boolean flags emitted right after `tick`.
// The "explose" typo is the REAL key (load-bearing).
export interface TickSounds {
  plant: boolean;
  kill: boolean;
  shoot: boolean;
  ricochet: boolean;
  explose: boolean;
}

// The `level_change` payload. The wire key is "Bcollision" (capital B).
// `level_id` is snake_case. The client reads only `blocks` + `Bcollision`.
export interface LevelChange {
  blocks: Block[];
  Bcollision: CollisonsBox[];
  level_id: number;
}

// Particle/explosion events: shoot_explosion / ricochet_explosion carry an angle.
export interface PositionAngleEvent {
  position: Vector2;
  angle: number;
}

// bullet_explosion / mine_explosion / player_explosion carry only a position.
export interface PositionEvent {
  position: Vector2;
}

// The `winner` payload. `socketid` is -1 (number) for a DRAW. The key
// "ids_to_name" (singular) drops the trailing "s" vs the Room field.
export interface WinnerPayload {
  socketid: string | number;
  waitingtime: number;
  player_scores: Record<string, StatsCounters>;
  ids_to_name: Record<string, string>;
}

// The `player-kill` payload. `players` is a [killerName, killedName] tuple.
export interface PlayerKillPayload {
  players: [string, string];
  type: "bullet" | "mine";
}

// The `countdown_start` payload (the web handler ignores it).
export interface CountdownStartPayload {
  duration: number;
}
