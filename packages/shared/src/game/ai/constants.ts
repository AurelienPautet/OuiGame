import { TANK_HULL_RADIUS_FACTOR } from "../check_collision.js";
import {
  BARREL_LENGTH,
  MINE_EXPLOSION_RADIUS,
  MINE_FUSE_TICKS as GAME_MINE_FUSE_TICKS,
  MINE_TRIGGER_RADIUS,
  TANK_SIZE as GAME_TANK_SIZE,
} from "../game_constants.js";

// Numeric facts of the simulation the AI reasons about. Everything the
// runtime exports is IMPORTED from game_constants.ts (single source of truth
// — a rebalance there moves the game and the bots' predictions together);
// only facts with no exported owner (grid geometry, the distance() blast
// offset) live here as documented mirrors.

// Map: 23 x 16 grid of 50 px tiles (level_loader.ts reads blocklist[row*23+col]).
export const COLS = 23;
export const ROWS = 16;
export const TILE = 50;
export const CELLS = COLS * ROWS;

// Tank chassis box (Player.size) + the circular hull used for all collisions.
export const TANK_SIZE = GAME_TANK_SIZE;
export const HULL_R = TANK_SIZE * TANK_HULL_RADIUS_FACTOR; // 20.7

// Mines (Mine.ts + Room.update_mines): no proximity trigger — a fixed fuse,
// then a blast measured from mine.position + (15,15) (the `distance()` helper
// adds size/2 to each position; mine "size" is 30x30 — no exported owner, so
// the offset is mirrored here). The blast pierces walls, chains mines and
// destroys type-2 blocks. Bullets trigger mines by touching the circle around
// mine.position with r = MINE_TRIGGER_R.
export const MINE_FUSE_TICKS = GAME_MINE_FUSE_TICKS;
export const MINE_BLAST_R = MINE_EXPLOSION_RADIUS;
export const MINE_BLAST_OFFSET = 15;
export const MINE_TRIGGER_R = MINE_TRIGGER_RADIUS;

// Player.endofbarrel(): bullets spawn (BARREL_LENGTH + bullet_w) px from the
// tank center along the aim direction.
export const MUZZLE_OFFSET = BARREL_LENGTH;

// The 8 steering/movement directions, matching Player.update's sign-only 8-way
// quantization (E, NE, N, NW, W, SW, S, SE). Float vectors for scoring math,
// integer signs for writing player.direction.
const SQ = Math.SQRT1_2;
export const DIR8_X = new Float64Array([1, SQ, 0, -SQ, -1, -SQ, 0, SQ]);
export const DIR8_Y = new Float64Array([0, -SQ, -1, -SQ, 0, SQ, 1, SQ]);
export const DSGN_X = [1, 1, 0, -1, -1, -1, 0, 1] as const;
export const DSGN_Y = [0, -1, -1, -1, 0, 1, 1, 1] as const;
// Index meaning "don't move" in steering candidate lists.
export const DIR_STOP = 8;

export function cellIdx(col: number, row: number): number {
  return row * COLS + col;
}

// Signed shortest angular difference target − current, wrapped to [-PI, PI].
// World angles throughout the AI are standard atan2 angles; the ONLY place the
// legacy turret convention appears is the single conversion in brain.ts
// (player.angle = worldAngle + PI, because Bullet velocity is -cos/-sin(angle)).
export function angleDiff(current: number, target: number): number {
  let d = (target - current) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
