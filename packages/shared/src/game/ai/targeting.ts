import { HULL_R, MINE_TRIGGER_R, MUZZLE_OFFSET, TILE } from "./constants.js";
import {
  BouncePath,
  castBounceRay,
  clampPredictPoint,
  segCircleHit,
  type AIGrid,
} from "./grid.js";
import type { ArchetypeAI } from "./archetypes.js";
import type { Room } from "../Room.js";
import type { Player } from "../Player.js";

// Shot planning. Three solution sources, all confirmed the same way (cast the
// real bounce path, then check ordered circle hits along it):
//   direct  — intercept-lead straight shot
//   unfold  — analytic 1-bounce: mirror the target AND its velocity across a
//             wall face's r-offset plane, solve the same intercept in unfolded
//             space (exact lead THROUGH the bounce)
//   fan     — a few exact bounce rays per think on a golden-angle rotating
//             phase, for opportunistic multi-bounce discoveries
// The best solution is cached and revalidated with one cast at fire time, so
// a wall breached after planning can never eat a "confirmed" shot.

const GOLDEN_STEP = Math.PI * 2 * 0.381966; // fan phase advance per think
const MAX_PLAN_DIST = 1400;
const SELF_SKIP_ARC = 50; // ignore self-overlap in the muzzle region
const FLIGHT_REF_S = 2.5; // tFlight at which shot quality reaches 0

export interface InterceptResult {
  t: number;
  x: number;
  y: number;
}

// Earliest interception of a target at q moving with velocity v by a bullet of
// speed s fired from p: |q + v·t − p| = s·t. Bullet speeds (300/600) always
// exceed tank speed (180), so a = v·v − s² < 0 and exactly one root is
// positive. Returns false only in degenerate numerical corners.
export function solveIntercept(
  px: number,
  py: number,
  qx: number,
  qy: number,
  vx: number,
  vy: number,
  s: number,
  out: InterceptResult
): boolean {
  const dx = qx - px;
  const dy = qy - py;
  const c = dx * dx + dy * dy;
  if (c < 1e-9) {
    out.t = 0;
    out.x = qx;
    out.y = qy;
    return true;
  }
  const a = vx * vx + vy * vy - s * s;
  const b = 2 * (dx * vx + dy * vy);
  if (a > -1e-9) {
    // Target as fast as the bullet (cannot happen with current numbers).
    if (b >= 0) return false;
    out.t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    out.t = (-b - Math.sqrt(disc)) / (2 * a);
  }
  if (!(out.t >= 0) || !Number.isFinite(out.t)) return false;
  out.x = qx + vx * out.t;
  out.y = qy + vy * out.t;
  return true;
}

export class ShotSolution {
  kind: 0 | 1 | 2 = 0; // none | direct | bank
  worldAngle = 0;
  tFlight = 0;
  quality = 0;
  bounces = 0;
  geometryVersion = -1;
  targetId = "";
  acquiredTick = 0;
  lastValidTick = -1e9;
  // Unfold transform of the segment that reaches the target (identity for
  // direct) — lets the per-tick micro-aim retarget the live lead point with
  // two multiplies and an atan2, no re-search.
  usx = 1;
  usy = 1;
  utx = 0;
  uty = 0;

  clear(): void {
    this.kind = 0;
    this.quality = 0;
  }
}

export function muzzleX(bot: Player, worldAngle: number): number {
  return (
    bot.position.x +
    bot.size.w / 2 +
    (MUZZLE_OFFSET + bot.bullet_size.w) * Math.cos(worldAngle)
  );
}

export function muzzleY(bot: Player, worldAngle: number): number {
  return (
    bot.position.y +
    bot.size.h / 2 +
    (MUZZLE_OFFSET + bot.bullet_size.h) * Math.sin(worldAngle)
  );
}

interface PathCheck {
  targetArc: number; // arc length where a human hull is first struck (-1 none)
  blockedArc: number; // arc length of the first friendly/self/mine strike (-1)
}
const PATH_CHECK: PathCheck = { targetArc: -1, blockedArc: -1 };

// Ordered circle tests along a folded bounce path. The strike test runs
// against the PREDICTED target centre (qPred — where the lead math says the
// target will be at impact time), NOT its current hull: a led shot is aimed
// where nobody is standing yet. Hazards (friendly bots, the shooter itself on
// banked returns, mines) are tested at their current positions and must not
// precede the strike. Friendly-fire is real in this engine — no team check
// exists in Room.update_bullets — so these vetoes are load-bearing. A hit on
// a DIFFERENT human before the strike is not a veto (it's still a kill).
function checkPath(
  path: BouncePath,
  bot: Player,
  room: Room,
  bulletR: number,
  qPredX: number,
  qPredY: number,
  out: PathCheck
): void {
  out.targetArc = -1;
  out.blockedArc = -1;
  // Strike radius slightly shaved, hazard radii padded: borderline geometry
  // must never flatter the plan.
  const strikeR = HULL_R + bulletR - 2;
  const hazardR = HULL_R + bulletR + 2;
  const segs = path.n - 1;
  for (let i = 0; i < segs; i++) {
    const x0 = path.xs[i]!;
    const y0 = path.ys[i]!;
    const segLen = path.segStart[i + 1]! - path.segStart[i]!;
    if (segLen <= 1e-6) continue;
    const ux = (path.xs[i + 1]! - x0) / segLen;
    const uy = (path.ys[i + 1]! - y0) / segLen;
    const base = path.segStart[i]!;

    if (out.targetArc < 0) {
      const s = segCircleHit(x0, y0, ux, uy, segLen, qPredX, qPredY, strikeR);
      if (s >= 0) out.targetArc = base + s;
    }

    for (const socketid in room.players) {
      const p = room.players[socketid];
      if (!p || !p.alive || p.position == undefined) continue;
      if (p !== bot && !socketid.includes("bot")) continue; // humans: no veto
      const cx = p.position.x + p.size.w / 2;
      const cy = p.position.y + p.size.h / 2;
      const s = segCircleHit(x0, y0, ux, uy, segLen, cx, cy, hazardR);
      if (s < 0) continue;
      const arc = base + s;
      if (p === bot && arc <= SELF_SKIP_ARC) continue; // muzzle region
      if (out.blockedArc < 0 || arc < out.blockedArc) out.blockedArc = arc;
    }

    for (let k = 0; k < room.mines.length; k++) {
      const m = room.mines[k]!;
      const s = segCircleHit(
        x0,
        y0,
        ux,
        uy,
        segLen,
        m.position.x,
        m.position.y,
        MINE_TRIGGER_R + bulletR + 4
      );
      if (s >= 0) {
        const arc = base + s;
        if (out.blockedArc < 0 || arc < out.blockedArc) out.blockedArc = arc;
      }
    }
  }
}

const CONFIRM_PATH = new BouncePath();
const ICPT = { t: 0, x: 0, y: 0 };

// Cast the real path for an aim angle and accept it if it cleanly reaches the
// predicted target point. Returns quality (0 = rejected) and fills `sol`.
function confirmAim(
  grid: AIGrid,
  bot: Player,
  room: Room,
  worldAngle: number,
  maxBounces: number,
  qPredX: number,
  qPredY: number,
  sol: ShotSolution,
  directBonus: boolean
): number {
  const bulletR = bot.bullet_size.w / 2;
  const mx = muzzleX(bot, worldAngle);
  const my = muzzleY(bot, worldAngle);
  castBounceRay(
    grid,
    mx,
    my,
    Math.cos(worldAngle),
    Math.sin(worldAngle),
    maxBounces,
    MAX_PLAN_DIST,
    bulletR,
    CONFIRM_PATH
  );
  if (CONFIRM_PATH.grazed) return 0;

  checkPath(CONFIRM_PATH, bot, room, bulletR, qPredX, qPredY, PATH_CHECK);
  if (PATH_CHECK.targetArc < 0) return 0;
  if (
    PATH_CHECK.blockedArc >= 0 &&
    PATH_CHECK.blockedArc < PATH_CHECK.targetArc
  )
    return 0;

  const seg = segOfArc(CONFIRM_PATH, PATH_CHECK.targetArc);
  const tFlight = PATH_CHECK.targetArc / bot.shoot_speed;
  // Quality: prefer fast impacts, but keep a distance-based floor so slow
  // (300 px/s) kinds still take low-priority long shots instead of holding
  // fire forever across a big map.
  let q = Math.max(
    1 - tFlight / FLIGHT_REF_S,
    0.45 * (1 - PATH_CHECK.targetArc / MAX_PLAN_DIST)
  );
  if (q < 0) q = 0;
  for (let b = 0; b < CONFIRM_PATH.bounces; b++) q *= 0.85;
  // Counting only bounces before the strike would be slightly kinder, but
  // bounces-after-strike paths are rare and the malus is conservative.
  if (directBonus && CONFIRM_PATH.bounces === 0) q *= 1.15;
  if (q <= 0) return 0;

  sol.kind = CONFIRM_PATH.bounces === 0 ? 1 : 2;
  sol.worldAngle = worldAngle;
  sol.tFlight = tFlight;
  sol.quality = q;
  sol.bounces = CONFIRM_PATH.bounces;
  sol.geometryVersion = grid.version;
  sol.usx = CONFIRM_PATH.sx[seg]!;
  sol.usy = CONFIRM_PATH.sy[seg]!;
  sol.utx = CONFIRM_PATH.tx[seg]!;
  sol.uty = CONFIRM_PATH.ty[seg]!;
  return q;
}

const CANDIDATE = new ShotSolution();
const PRED = { x: 0, y: 0 };

// The lead point every candidate aims at: the target's position after t
// seconds of its (smoothed, λ-scaled) velocity — CLAMPED against the movement
// grid, modelling the chassis' wall slide. A straight q + λvt projects
// through walls, making bots aim at spots a wall-bound target can never
// reach (and shoot the wall in front of wall-huggers).
function leadPoint(
  grid: AIGrid,
  qx: number,
  qy: number,
  tvx: number,
  tvy: number,
  lam: number,
  t: number,
  out: { x: number; y: number }
): void {
  clampPredictPoint(grid, qx, qy, qx + lam * tvx * t, qy + lam * tvy * t, out);
}

// Full targeting refresh (think cadence). Writes the best confirmed solution
// for `target` into `sol` (clearing it when nothing qualifies). `fanPhase` is
// owned by the brain and advanced here.
export function refreshSolution(
  grid: AIGrid,
  bot: Player,
  room: Room,
  target: Player,
  tvx: number,
  tvy: number,
  ai: ArchetypeAI,
  sol: ShotSolution,
  brainFan: { phase: number }
): void {
  const bcx = bot.position.x + bot.size.w / 2;
  const bcy = bot.position.y + bot.size.h / 2;
  const qx = target.position.x + target.size.w / 2;
  const qy = target.position.y + target.size.h / 2;
  const s = bot.shoot_speed;
  const lam = ai.leadFactor;

  let bestQ = 0;
  let found = false;

  // ---- direct intercept ----
  if (solveIntercept(bcx, bcy, qx, qy, tvx, tvy, s, ICPT)) {
    leadPoint(grid, qx, qy, tvx, tvy, lam, ICPT.t, PRED);
    const ang = Math.atan2(PRED.y - bcy, PRED.x - bcx);
    const q = confirmAim(
      grid,
      bot,
      room,
      ang,
      0,
      PRED.x,
      PRED.y,
      CANDIDATE,
      true
    );
    if (q > bestQ) {
      bestQ = q;
      copySolution(CANDIDATE, sol, target.socketid);
      found = true;
    }
  }

  // ---- analytic 1-bounce mirror candidates ----
  if (ai.maxPlanBounces >= 1 && ai.unfoldBudget > 0) {
    const bulletR = bot.bullet_size.w / 2;
    let budget = ai.unfoldBudget;
    const boxes = room.Bcollision;
    for (let i = 0; i < boxes.length && budget > 0; i++) {
      const box = boxes[i]!;
      const bx0 = box.position.x;
      const by0 = box.position.y;
      const bx1 = bx0 + box.size.w;
      const by1 = by0 + box.size.h;

      // Vertical faces (reflect x). Mirror plane is the face offset OUTWARD
      // by the bullet radius — the exact surface the bullet centre reflects
      // on (Minkowski).
      if (bcx < bx0 || bcx > bx1) {
        const plane = bcx < bx0 ? bx0 - bulletR : bx1 + bulletR;
        const mqx = 2 * plane - qx;
        const mvx = -tvx;
        if (
          solveIntercept(bcx, bcy, mqx, qy, mvx, tvy, s, ICPT) &&
          ICPT.t * s < MAX_PLAN_DIST
        ) {
          // Clamp the lead in WORLD space, then mirror the clamped point.
          leadPoint(grid, qx, qy, tvx, tvy, lam, ICPT.t, PRED);
          const dirX = 2 * plane - PRED.x - bcx;
          const dirY = PRED.y - bcy;
          const tb = (plane - bcx) / dirX;
          if (tb > 0 && tb < 1) {
            const hitY = bcy + tb * dirY;
            // Bounce point must land on the face proper (shrunk: the corner
            // band is graze territory).
            if (hitY > by0 && hitY < by1) {
              const ang = Math.atan2(dirY, dirX);
              const q = confirmAim(
                grid,
                bot,
                room,
                ang,
                ai.maxPlanBounces,
                PRED.x,
                PRED.y,
                CANDIDATE,
                false
              );
              budget--;
              if (q > bestQ) {
                bestQ = q;
                copySolution(CANDIDATE, sol, target.socketid);
                found = true;
              }
            }
          }
        }
      }

      // Horizontal faces (reflect y).
      if ((bcy < by0 || bcy > by1) && budget > 0) {
        const plane = bcy < by0 ? by0 - bulletR : by1 + bulletR;
        const mqy = 2 * plane - qy;
        const mvy = -tvy;
        if (
          solveIntercept(bcx, bcy, qx, mqy, tvx, mvy, s, ICPT) &&
          ICPT.t * s < MAX_PLAN_DIST
        ) {
          leadPoint(grid, qx, qy, tvx, tvy, lam, ICPT.t, PRED);
          const dirX = PRED.x - bcx;
          const dirY = 2 * plane - PRED.y - bcy;
          const tb = (plane - bcy) / dirY;
          if (tb > 0 && tb < 1) {
            const hitX = bcx + tb * dirX;
            if (hitX > bx0 && hitX < bx1) {
              const ang = Math.atan2(dirY, dirX);
              const q = confirmAim(
                grid,
                bot,
                room,
                ang,
                ai.maxPlanBounces,
                PRED.x,
                PRED.y,
                CANDIDATE,
                false
              );
              budget--;
              if (q > bestQ) {
                bestQ = q;
                copySolution(CANDIDATE, sol, target.socketid);
                found = true;
              }
            }
          }
        }
      }
    }
  }

  // ---- rotating fan: multi-bounce discovery ----
  if (ai.fanRays > 0 && ai.maxPlanBounces >= 1) {
    brainFan.phase = (brainFan.phase + GOLDEN_STEP) % (Math.PI * 2);
    const bulletR = bot.bullet_size.w / 2;
    for (let k = 0; k < ai.fanRays; k++) {
      const ang = brainFan.phase + (k * Math.PI * 2) / ai.fanRays;
      const mx = muzzleX(bot, ang);
      const my = muzzleY(bot, ang);
      castBounceRay(
        grid,
        mx,
        my,
        Math.cos(ang),
        Math.sin(ang),
        ai.maxPlanBounces,
        MAX_PLAN_DIST,
        bulletR,
        CONFIRM_PATH
      );
      if (CONFIRM_PATH.grazed) continue;

      // Discovery pass: does this ray reach the target's CURRENT hull?
      let arc = -1;
      let seg = 0;
      for (let i = 0; i < CONFIRM_PATH.n - 1 && arc < 0; i++) {
        const x0 = CONFIRM_PATH.xs[i]!;
        const y0 = CONFIRM_PATH.ys[i]!;
        const segLen =
          CONFIRM_PATH.segStart[i + 1]! - CONFIRM_PATH.segStart[i]!;
        if (segLen <= 1e-6) continue;
        const hit = segCircleHit(
          x0,
          y0,
          (CONFIRM_PATH.xs[i + 1]! - x0) / segLen,
          (CONFIRM_PATH.ys[i + 1]! - y0) / segLen,
          segLen,
          qx,
          qy,
          HULL_R + bulletR + 20 // generous: the refine pass re-aims exactly
        );
        if (hit >= 0) {
          arc = CONFIRM_PATH.segStart[i]! + hit;
          seg = i;
        }
      }
      if (arc < 0) continue;

      // Refine: lead the target by the discovered flight time (wall-clamped),
      // re-aim at the unfolded lead point, confirm the exact path.
      const tFlight = arc / s;
      leadPoint(grid, qx, qy, tvx, tvy, lam, tFlight, PRED);
      const ux = CONFIRM_PATH.sx[seg]! * PRED.x + CONFIRM_PATH.tx[seg]!;
      const uy = CONFIRM_PATH.sy[seg]! * PRED.y + CONFIRM_PATH.ty[seg]!;
      const refined = Math.atan2(uy - my, ux - mx);
      const q = confirmAim(
        grid,
        bot,
        room,
        refined,
        ai.maxPlanBounces,
        PRED.x,
        PRED.y,
        CANDIDATE,
        false
      );
      if (q > bestQ) {
        bestQ = q;
        copySolution(CANDIDATE, sol, target.socketid);
        found = true;
      }
    }
  }

  if (!found) sol.clear();
}

function copySolution(
  from: ShotSolution,
  to: ShotSolution,
  targetId: string
): void {
  to.kind = from.kind;
  to.worldAngle = from.worldAngle;
  to.tFlight = from.tFlight;
  to.quality = from.quality;
  to.bounces = from.bounces;
  to.geometryVersion = from.geometryVersion;
  to.usx = from.usx;
  to.usy = from.usy;
  to.utx = from.utx;
  to.uty = from.uty;
  to.targetId = targetId;
}

// Segment index containing a given arc length along a path.
function segOfArc(path: BouncePath, arc: number): number {
  let seg = 0;
  while (seg < path.n - 2 && path.segStart[seg + 1]! < arc) seg++;
  return seg;
}

// Fire-commit revalidation: one cast along the angle the turret is about to
// shoot, against the live lead point (same smoothed velocity the micro-aim
// tracks, so the check tests the shot actually being taken). The last line of
// defence against breached walls / drifted targets / friends walking in.
export function validateAim(
  grid: AIGrid,
  bot: Player,
  room: Room,
  target: Player,
  tvx: number,
  tvy: number,
  worldAngle: number,
  ai: ArchetypeAI,
  sol: ShotSolution
): boolean {
  const qx = target.position.x + target.size.w / 2;
  const qy = target.position.y + target.size.h / 2;
  leadPoint(grid, qx, qy, tvx, tvy, ai.leadFactor, sol.tFlight, PRED);
  return (
    confirmAim(
      grid,
      bot,
      room,
      worldAngle,
      ai.maxPlanBounces,
      PRED.x,
      PRED.y,
      CANDIDATE,
      sol.kind === 1
    ) > 0
  );
}

// Per-tick micro-aim: desired world angle for the cached solution against the
// live target state. Direct solutions re-solve the intercept (~30 flops);
// banked ones map the lead point through the cached unfold transform. Lead
// points are wall-clamped like every planning prediction.
export function desiredAngleFor(
  grid: AIGrid,
  bot: Player,
  target: Player,
  tvx: number,
  tvy: number,
  ai: ArchetypeAI,
  sol: ShotSolution,
  prevDesired: number
): number {
  const bcx = bot.position.x + bot.size.w / 2;
  const bcy = bot.position.y + bot.size.h / 2;
  const qx = target.position.x + target.size.w / 2;
  const qy = target.position.y + target.size.h / 2;
  if (sol.kind === 1) {
    if (solveIntercept(bcx, bcy, qx, qy, tvx, tvy, bot.shoot_speed, ICPT)) {
      leadPoint(grid, qx, qy, tvx, tvy, ai.leadFactor, ICPT.t, PRED);
      return Math.atan2(PRED.y - bcy, PRED.x - bcx);
    }
    return Math.atan2(qy - bcy, qx - bcx);
  }
  // Bank: lead with the cached flight time, unfold, aim from the muzzle the
  // turret is already tracking toward (second-order error only).
  leadPoint(grid, qx, qy, tvx, tvy, ai.leadFactor, sol.tFlight, PRED);
  const ux = sol.usx * PRED.x + sol.utx;
  const uy = sol.usy * PRED.y + sol.uty;
  return Math.atan2(
    uy - muzzleY(bot, prevDesired),
    ux - muzzleX(bot, prevDesired)
  );
}

// Rough distance in tiles for prioritisation fallbacks.
export function tileDist(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  return Math.hypot(bx - ax, by - ay) / TILE;
}
