import { TANK_HULL_RADIUS_FACTOR } from "../check_collision.js";

// Shared numeric facts of the simulation the AI reasons about. Each value
// mirrors a source-of-truth literal elsewhere in the runtime (noted per line);
// the AI never redefines behaviour, it only predicts it.

// Map: 23 x 16 grid of 50 px tiles (level_loader.ts reads blocklist[row*23+col]).
export const COLS = 23;
export const ROWS = 16;
export const TILE = 50;
export const CELLS = COLS * ROWS;

// Tank chassis: 45x45 box (Player.ts), circular hull used for all collisions.
export const TANK_SIZE = 45;
export const HULL_R = TANK_SIZE * TANK_HULL_RADIUS_FACTOR; // 20.7

// Player.update clamps tank top-left to x∈[50, 1100-45], y∈[50, 800-45] — tank
// centers therefore stay in cols 1..21 / rows 1..15; col 0/22 and row 0 are
// unreachable for movement even when their cells are empty.
export const TANK_MIN_C = 72.5;

// Mines (Mine.ts + Room.update_mines): no proximity trigger — a fixed fuse of
// 300 ticks, then a 90 px blast measured from mine.position + (15,15) (the
// `distance()` helper adds size/2 to each position; mine "size" is 30x30).
// The blast pierces walls, chains mines and destroys type-2 blocks. Bullets
// trigger mines by touching the circle around mine.position with r=15.
export const MINE_FUSE_TICKS = 300;
export const MINE_BLAST_R = 90;
export const MINE_BLAST_OFFSET = 15;
export const MINE_TRIGGER_R = 15;

// Player.endofbarrel(): bullets spawn (30 + bullet_w) px from the tank center
// along the aim direction.
export const MUZZLE_OFFSET = 30;

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
