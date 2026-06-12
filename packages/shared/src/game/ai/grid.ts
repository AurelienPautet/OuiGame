import { COLS, ROWS, TILE, CELLS, cellIdx } from "./constants.js";

// Occupancy grids + grid raycasting (Amanatides & Woo DDA). This is the AI's
// model of the level geometry, rebuilt from room.blocklist whenever it changes
// (level load, mine wall-breach — detected upstream by array identity).
//
// Two distinct solidity sets, because the simulation treats them differently:
//   walls — blocks bullets/rays (blocklist 1|2). Holes are NOT here: bullets
//           fly over holes (Room keeps holes out of Bcollision).
//   move  — blocks tank movement: walls + holes(4) + the border ring of cells
//           tank centers can never occupy (Player.update's clamp).
//
// Ray model: Bullet.ts sweeps the bullet centre against walls inflated by the
// bullet's half-extents (Minkowski sum), reflecting off axis-aligned faces. A
// point ray against cell faces offset by r reproduces that EXACTLY for face
// hits; the only divergence is a pass within r of an exposed solid corner
// (the inflated union is square there, the offset-plane walk is not). Those
// crossings set `grazed` instead of being modelled — shot planning rejects
// grazed paths, so a bot's "confirmed" shot always behaves as previewed.

const EPS = 1e-9;
// Corner pad: flag a graze when the crossing point passes within r + this many
// px of a lattice corner that has a solid diagonal neighbour.
const GRAZE_PAD = 2;

export class AIGrid {
  walls = new Uint8Array(CELLS);
  wallType = new Uint8Array(CELLS); // raw 0|1|2 (breached cells read 0)
  move = new Uint8Array(CELLS);
  corridor = new Uint8Array(CELLS); // free cell with exactly 2 free 4-neighbours
  version = 0;

  rebuild(blocklist: number[]): void {
    const { walls, wallType, move, corridor } = this;
    walls.fill(0);
    wallType.fill(0);
    move.fill(0);
    corridor.fill(0);
    const n = Math.min(blocklist.length, CELLS);
    for (let i = 0; i < n; i++) {
      const v = blocklist[i]!;
      if (v === 1 || v === 2) {
        walls[i] = 1;
        wallType[i] = v;
        move[i] = 1;
      } else if (v === 4) {
        move[i] = 1;
      }
    }
    // Cells tank centers can never occupy (see constants.ts clamp note).
    for (let r = 0; r < ROWS; r++) {
      move[cellIdx(0, r)] = 1;
      move[cellIdx(COLS - 1, r)] = 1;
    }
    for (let c = 0; c < COLS; c++) {
      move[cellIdx(c, 0)] = 1;
    }
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 1; c < COLS - 1; c++) {
        const i = cellIdx(c, r);
        if (move[i]!) continue;
        let free = 0;
        if (!move[i - 1]!) free++;
        if (!move[i + 1]!) free++;
        if (!move[i - COLS]!) free++;
        if (!move[i + COLS]!) free++;
        if (free === 2) corridor[i] = 1;
      }
    }
    this.version++;
  }

  // Out-of-grid counts as solid: rays stop at the map edge even if a level is
  // missing its border walls (a real bullet would fly forever there; a bot
  // should simply never plan such a shot).
  solidAt(col: number, row: number): number {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 1;
    return this.walls[row * COLS + col]!;
  }

  moveBlockedAt(col: number, row: number): number {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 1;
    return this.move[row * COLS + col]!;
  }
}

export function isWallAtPx(g: AIGrid, x: number, y: number): boolean {
  return g.solidAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 1;
}

export function isMoveBlockedAtPx(g: AIGrid, x: number, y: number): boolean {
  return g.moveBlockedAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 1;
}

export interface RayHit {
  x: number;
  y: number;
  t: number; // distance along the ray
  axis: 0 | 1; // 0 = vertical face hit (reflect x), 1 = horizontal (reflect y)
  grazed: boolean;
}

export function makeRayHit(): RayHit {
  return { x: 0, y: 0, t: 0, axis: 0, grazed: false };
}

// March a circle of radius r from (ox,oy) along the unit direction (dx,dy)
// until it touches a wall (true, `out` filled) or maxDist is covered (false;
// out.t = maxDist, out.grazed still meaningful). O(cells crossed).
//
// Graze semantics (two deliberate rules):
//  - A graze is only flagged when the crossing enters a FREE cell whose
//    corner-adjacent diagonal is solid. Entering a SOLID cell near the seam
//    of a continuous wall is a clean face hit, not a corner clip.
//  - `skipStartGraze` (used for post-reflection segments) suppresses probes
//    within r+pad of the segment start: a freshly bounced ray necessarily
//    starts inside the r-band of the wall it just reflected off, which is
//    legitimate contact, not a graze.
export function castRay(
  g: AIGrid,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxDist: number,
  r: number,
  out: RayHit,
  skipStartGraze = false
): boolean {
  let cx = Math.floor(ox / TILE);
  let cy = Math.floor(oy / TILE);
  out.grazed = false;
  const band = r + GRAZE_PAD;

  if (g.solidAt(cx, cy)) {
    // Starting inside a solid cell: immediate hit (callers treat this as
    // "no usable path", e.g. a muzzle poking into a wall).
    out.x = ox;
    out.y = oy;
    out.t = 0;
    out.axis = 0;
    return true;
  }

  if (!skipStartGraze) {
    // Initial proximity grazes: already within the r-band of an adjacent
    // solid cell (covers rays travelling parallel to a wall inside the band —
    // they also re-flag at subsequent lattice crossings).
    const fx0 = ox - cx * TILE;
    const fy0 = oy - cy * TILE;
    if (fy0 < band && g.solidAt(cx, cy - 1)) out.grazed = true;
    else if (fy0 > TILE - band && g.solidAt(cx, cy + 1)) out.grazed = true;
    if (fx0 < band && g.solidAt(cx - 1, cy)) out.grazed = true;
    else if (fx0 > TILE - band && g.solidAt(cx + 1, cy)) out.grazed = true;
  }
  const grazeFromT = skipStartGraze ? band + 0.1 : -1;

  const stepX = dx > EPS ? 1 : dx < -EPS ? -1 : 0;
  const stepY = dy > EPS ? 1 : dy < -EPS ? -1 : 0;
  if (stepX === 0 && stepY === 0) {
    out.t = maxDist;
    return false;
  }

  // Parametric distance to the r-offset face of the next cell on each axis.
  // Faces sit 50 apart, so after the first crossing each next one is +tDelta.
  let tMaxX = Infinity;
  let tDeltaX = Infinity;
  if (stepX !== 0) {
    const plane = stepX > 0 ? (cx + 1) * TILE - r : cx * TILE + r;
    tMaxX = (plane - ox) / dx;
    if (tMaxX < 0) tMaxX = 0; // already within r of that face
    tDeltaX = TILE / Math.abs(dx);
  }
  let tMaxY = Infinity;
  let tDeltaY = Infinity;
  if (stepY !== 0) {
    const plane = stepY > 0 ? (cy + 1) * TILE - r : cy * TILE + r;
    tMaxY = (plane - oy) / dy;
    if (tMaxY < 0) tMaxY = 0;
    tDeltaY = TILE / Math.abs(dy);
  }

  // Bounded by grid size: a ray crosses at most COLS+ROWS cells per traversal,
  // but maxDist can re-enter via reflections upstream, so cap generously.
  for (let guard = 0; guard < 256; guard++) {
    if (tMaxX <= tMaxY) {
      if (tMaxX > maxDist) break;
      const nx = cx + stepX;
      const ycross = oy + tMaxX * dy;
      if (g.solidAt(nx, cy)) {
        out.x = ox + tMaxX * dx;
        out.y = ycross;
        out.t = tMaxX;
        out.axis = 0;
        return true;
      }
      if (tMaxX > grazeFromT) {
        // Probe rows derive from the crossing COORDINATE: the DDA-tracked cy
        // runs up to r ahead of the true boundary (offset planes), so using
        // it would probe a diagonal a full row off near corners.
        const prow = Math.floor(ycross / TILE);
        const frac = ycross - prow * TILE;
        if (frac < band && g.solidAt(nx, prow - 1)) out.grazed = true;
        else if (frac > TILE - band && g.solidAt(nx, prow + 1))
          out.grazed = true;
      }
      cx = nx;
      tMaxX += tDeltaX;
    } else {
      if (tMaxY > maxDist) break;
      const ny = cy + stepY;
      const xcross = ox + tMaxY * dx;
      if (g.solidAt(cx, ny)) {
        out.x = xcross;
        out.y = oy + tMaxY * dy;
        out.t = tMaxY;
        out.axis = 1;
        return true;
      }
      if (tMaxY > grazeFromT) {
        const pcol = Math.floor(xcross / TILE);
        const frac = xcross - pcol * TILE;
        if (frac < band && g.solidAt(pcol - 1, ny)) out.grazed = true;
        else if (frac > TILE - band && g.solidAt(pcol + 1, ny))
          out.grazed = true;
      }
      cy = ny;
      tMaxY += tDeltaY;
    }
  }
  out.t = maxDist;
  return false;
}

const SEG_SCRATCH = makeRayHit();

// Is the swept circle's path from (x0,y0) to (x1,y1) free of walls AND corner
// grazes? Used for line-of-sight (small r) and for validating planned shot
// segments (bullet r — graze-strict, see header note).
export function segmentClear(
  g: AIGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return !isWallAtPx(g, x0, y0);
  const hit = castRay(g, x0, y0, dx / len, dy / len, len, r, SEG_SCRATCH);
  return !hit && !SEG_SCRATCH.grazed;
}

// A multi-bounce ray path. Vertices 0..n-1; segment i runs vertex i → i+1 and
// carries unfold transform i: u_i(p) = (sx[i]·px + tx[i], sy[i]·py + ty[i]),
// mapping a WORLD point into the straight-line ("unfolded") space of that
// segment. Aiming at u_i(target) from the origin is exactly the folded path
// that reaches the target on segment i — including through every reflection,
// so intercept-lead math works unchanged on banked shots.
export class BouncePath {
  n = 0;
  xs = new Float64Array(6);
  ys = new Float64Array(6);
  segStart = new Float64Array(6); // cumulative arc length at vertex i
  sx = new Float64Array(6);
  sy = new Float64Array(6);
  tx = new Float64Array(6);
  ty = new Float64Array(6);
  bounces = 0;
  grazed = false;
  totalLen = 0;
  // true when the path ended by distance/bounce budget rather than a dead end
  endedOnWall = false;
}

const BOUNCE_SCRATCH = makeRayHit();
// Matches Bullet.ts's SKIN: nudge off the surface after a reflection so the
// next cast doesn't re-detect the same face at distance 0.
const SKIN = 0.01;

// Walk up to maxBounces reflections (maxBounces+1 segments) from (ox,oy).
// The final segment ends at maxDist or at the wall the bullet would die on.
export function castBounceRay(
  g: AIGrid,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  maxBounces: number,
  maxDist: number,
  r: number,
  out: BouncePath
): void {
  let px = ox;
  let py = oy;
  let vx = dx;
  let vy = dy;
  let sx = 1;
  let sy = 1;
  let tx = 0;
  let ty = 0;
  let traveled = 0;

  out.bounces = 0;
  out.grazed = false;
  out.endedOnWall = false;
  out.xs[0] = ox;
  out.ys[0] = oy;
  out.segStart[0] = 0;
  out.sx[0] = 1;
  out.sy[0] = 1;
  out.tx[0] = 0;
  out.ty[0] = 0;
  out.n = 1;

  for (let seg = 0; seg <= maxBounces; seg++) {
    // Segments after a reflection start inside the r-band of the wall they
    // just bounced off — legitimate contact, so start-adjacent graze probes
    // are suppressed for them (see castRay's graze semantics).
    const hit = castRay(
      g,
      px,
      py,
      vx,
      vy,
      maxDist - traveled,
      r,
      BOUNCE_SCRATCH,
      seg > 0
    );
    if (BOUNCE_SCRATCH.grazed) out.grazed = true;
    if (!hit) {
      const remain = maxDist - traveled;
      out.xs[out.n] = px + vx * remain;
      out.ys[out.n] = py + vy * remain;
      out.segStart[out.n] = maxDist;
      out.n++;
      out.totalLen = maxDist;
      return;
    }
    traveled += BOUNCE_SCRATCH.t;
    px = BOUNCE_SCRATCH.x;
    py = BOUNCE_SCRATCH.y;
    out.xs[out.n] = px;
    out.ys[out.n] = py;
    out.segStart[out.n] = traveled;
    if (seg === maxBounces) {
      // The bullet dies on this wall contact — path ends here.
      out.n++;
      out.totalLen = traveled;
      out.endedOnWall = true;
      return;
    }
    // Reflect, and fold the unfold transform: u_next = u_prev ∘ reflect.
    // Reflecting across the vertical offset plane x = px gives
    // u_next(p).x = sx·(2·px − p.x) + tx ⇒ tx += 2·px·sx, sx = −sx.
    if (BOUNCE_SCRATCH.axis === 0) {
      tx += 2 * px * sx;
      sx = -sx;
      vx = -vx;
    } else {
      ty += 2 * py * sy;
      sy = -sy;
      vy = -vy;
    }
    out.sx[out.n] = sx;
    out.sy[out.n] = sy;
    out.tx[out.n] = tx;
    out.ty[out.n] = ty;
    out.n++;
    out.bounces++;
    px += vx * SKIN;
    py += vy * SKIN;
    traveled += SKIN;
  }
}

// Earliest distance s ∈ [0, segLen] at which a point moving from (x0,y0) along
// the unit (ux,uy) comes within R of (cx,cy); -1 if never. Closed form.
export function segCircleHit(
  x0: number,
  y0: number,
  ux: number,
  uy: number,
  segLen: number,
  cx: number,
  cy: number,
  R: number
): number {
  const rx = cx - x0;
  const ry = cy - y0;
  const proj = rx * ux + ry * uy;
  const perp2 = rx * rx + ry * ry - proj * proj;
  const R2 = R * R;
  if (perp2 > R2) return -1;
  const back = Math.sqrt(R2 - perp2);
  const s0 = proj - back;
  const s1 = proj + back;
  if (s1 < 0 || s0 > segLen) return -1;
  return s0 > 0 ? s0 : 0;
}
