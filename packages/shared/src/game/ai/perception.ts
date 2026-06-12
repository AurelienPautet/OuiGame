import {
  DIR8_X,
  DIR8_Y,
  HULL_R,
  MINE_BLAST_OFFSET,
  MINE_BLAST_R,
  MINE_FUSE_TICKS,
  MINE_TRIGGER_R,
  TILE,
} from "./constants.js";
import { castRay, makeRayHit, segmentClear, type AIGrid } from "./grid.js";
import { FLOW_INF } from "./flow.js";
import type { AIRoomState } from "./room_state.js";
import type { ArchetypeAI } from "./archetypes.js";
import type { Room } from "../Room.js";
import type { Player } from "../Player.js";

// Threat sensing: bullets via closest-point-of-approach on their (relative)
// trajectories, mines via fuse-weighted blast proximity. Cheap enough to run
// every tick for every mobile bot; results feed both the EVADE trigger and the
// per-direction danger the steering solve consumes.

// Padding beyond the geometric kill distance before a bullet "registers".
const BULLET_DANGER_PAD = 12;
// A mine matters within blast radius + this margin (tank can be clipped while
// standing off-centre).
const MINE_MARGIN = HULL_R * 2 + 4;

// One post-ricochet bullet continuation (a "virtual bullet" valid in the
// absolute-time window [t0, t1] seconds from now).
export interface BounceThreat {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  t1: number;
}

export class ThreatSummary {
  urgency = 0;
  dodgeX = 0;
  dodgeY = 0;
  mineUrgency = 0;
  mineAwayX = 0;
  mineAwayY = 0;
  imminentTCPA = Infinity;
  dirDanger = new Float64Array(8);

  reset(): void {
    this.urgency = 0;
    this.dodgeX = 0;
    this.dodgeY = 0;
    this.mineUrgency = 0;
    this.mineAwayX = 0;
    this.mineAwayY = 0;
    this.imminentTCPA = Infinity;
    this.dirDanger.fill(0);
  }
}

// Accumulate one bullet-like threat (real or post-bounce virtual) into ts.
// (rx,ry) bullet→bot offset at t=0, (vx,vy) relative velocity, window [t0,t1].
function accumulateBulletThreat(
  ts: ThreatSummary,
  rx: number,
  ry: number,
  vx: number,
  vy: number,
  t0: number,
  t1: number,
  bulletR: number,
  dodgeSkill: number,
  horizon: number,
  headOnSign: 1 | -1,
  bvx: number,
  bvy: number
): void {
  const vv = vx * vx + vy * vy;
  if (vv < 1) return;
  let t = -(rx * vx + ry * vy) / vv;
  if (t < t0) t = t0;
  if (t > t1) return;
  const dx = rx + vx * t;
  const dy = ry + vy * t;
  const R = HULL_R + bulletR + BULLET_DANGER_PAD;
  const d2 = dx * dx + dy * dy;
  if (d2 >= R * R) return;
  const d = Math.sqrt(d2);
  const u = (1 - d / R) * (1 - t / horizon) * dodgeSkill;
  if (u <= 0) return;

  // Escape direction: away from the closest-approach offset; when dead
  // head-on, dodge perpendicular to the bullet's travel (sign persisted by
  // the brain so the bot doesn't flip-flop mid-dodge).
  let ex = dx;
  let ey = dy;
  const el = Math.hypot(ex, ey);
  if (el < 6) {
    const bl = Math.hypot(bvx, bvy) || 1;
    ex = (-bvy / bl) * headOnSign;
    ey = (bvx / bl) * headOnSign;
  } else {
    ex /= el;
    ey /= el;
  }

  if (u > ts.urgency) ts.urgency = u;
  if (t < ts.imminentTCPA) ts.imminentTCPA = t;
  ts.dodgeX += u * ex;
  ts.dodgeY += u * ey;

  const bl = Math.hypot(bvx, bvy) || 1;
  const bnx = bvx / bl;
  const bny = bvy / bl;
  for (let i = 0; i < 8; i++) {
    // Moving against the escape direction is dangerous; so is moving along
    // the bullet's line (staying in its corridor), at lower weight.
    const intoThreat = -(DIR8_X[i]! * ex + DIR8_Y[i]! * ey);
    const alongLine = Math.abs(DIR8_X[i]! * bnx + DIR8_Y[i]! * bny);
    ts.dirDanger[i] =
      ts.dirDanger[i]! +
      u * (intoThreat > 0 ? intoThreat : 0) +
      0.4 * u * alongLine;
  }
}

export function senseThreats(
  bot: Player,
  room: Room,
  ts: ThreatSummary,
  ai: ArchetypeAI,
  headOnSign: 1 | -1,
  bounceThreats: readonly BounceThreat[],
  // Seconds since the bounce-threat list was refreshed (think cadence). The
  // stored windows/origins are relative to the refresh tick; rebasing them
  // here keeps post-ricochet timing exact on the ticks BETWEEN thinks.
  bounceAgeS: number,
  postMineActive: boolean
): void {
  ts.reset();
  const bcx = bot.position.x + bot.size.w / 2;
  const bcy = bot.position.y + bot.size.h / 2;

  if (ai.dodgeSkill > 0) {
    const horizon = ai.threatHorizonS;
    for (let i = 0; i < room.bullets.length; i++) {
      const b = room.bullets[i]!;
      const bulletR = Math.min(b.size.w, b.size.h) / 2;
      accumulateBulletThreat(
        ts,
        b.position.x + b.size.w / 2 - bcx,
        b.position.y + b.size.h / 2 - bcy,
        b.velocity.x - bot.velocity.x,
        b.velocity.y - bot.velocity.y,
        0,
        horizon,
        bulletR,
        ai.dodgeSkill,
        horizon,
        headOnSign,
        b.velocity.x,
        b.velocity.y
      );
    }
    for (let i = 0; i < bounceThreats.length; i++) {
      const v = bounceThreats[i]!;
      // Rebase the refresh-relative window to "now": the virtual bullet has
      // already flown bounceAgeS seconds of it.
      const t1 = Math.min(v.t1, horizon) - bounceAgeS;
      if (t1 <= 0) continue;
      const t0 = Math.max(v.t0 - bounceAgeS, 0);
      accumulateBulletThreat(
        ts,
        v.x + v.vx * bounceAgeS - bcx,
        v.y + v.vy * bounceAgeS - bcy,
        v.vx - bot.velocity.x,
        v.vy - bot.velocity.y,
        t0,
        t1,
        7.5,
        ai.dodgeSkill,
        horizon,
        headOnSign,
        v.vx,
        v.vy
      );
    }
  }

  // Mines threaten every mover regardless of dodgeSkill (even Wii's oblivious
  // yellow tank avoids mines). Blast center carries the engine's +15 offset.
  const zone = MINE_BLAST_R + MINE_MARGIN;
  for (let i = 0; i < room.mines.length; i++) {
    const m = room.mines[i]!;
    const mx = m.position.x + MINE_BLAST_OFFSET;
    const my = m.position.y + MINE_BLAST_OFFSET;
    const dx = bcx - mx;
    const dy = bcy - my;
    const d = Math.hypot(dx, dy);
    if (d > zone + 40) continue;

    let fuse = m.timealive / MINE_FUSE_TICKS;
    fuse = fuse * fuse * fuse;
    if (fuse > 1) fuse = 1;
    if (postMineActive && m.emitter === bot) {
      // Own fresh mine: treat as fully armed so the bot clears the blast.
      fuse = 1;
    } else if (fuse < 1) {
      // A bullet about to strike the mine arms it NOW (bullet hits trigger
      // the fuse instantly; the blast lands one tick later).
      for (let k = 0; k < room.bullets.length; k++) {
        const b = room.bullets[k]!;
        const bulletR = Math.min(b.size.w, b.size.h) / 2;
        const rx = m.position.x - (b.position.x + b.size.w / 2);
        const ry = m.position.y - (b.position.y + b.size.h / 2);
        const vv = b.velocity.x ** 2 + b.velocity.y ** 2;
        if (vv < 1) continue;
        const t = (rx * b.velocity.x + ry * b.velocity.y) / vv;
        if (t < 0 || t > 0.5) continue;
        const px = rx - b.velocity.x * t;
        const py = ry - b.velocity.y * t;
        const trig = MINE_TRIGGER_R + bulletR;
        if (px * px + py * py <= trig * trig) {
          fuse = 1;
          break;
        }
      }
    }

    let prox = (zone - d) / MINE_MARGIN;
    if (prox > 1) prox = 1;
    if (prox < 0) prox = 0;
    const u = fuse * prox;
    if (u <= 0) continue;
    if (u > ts.mineUrgency) ts.mineUrgency = u;
    const il = d || 1;
    const ax = dx / il;
    const ay = dy / il;
    ts.mineAwayX += u * ax;
    ts.mineAwayY += u * ay;
    for (let k = 0; k < 8; k++) {
      const toward = -(DIR8_X[k]! * ax + DIR8_Y[k]! * ay);
      if (toward > 0) ts.dirDanger[k] = ts.dirDanger[k]! + u * toward;
    }
  }
}

const BOUNCE_RAY = makeRayHit();

// Think-cadence: store the first post-wall reflection of every nearby bullet
// as a virtual bullet, so the per-tick CPA also sees bank shots curving in.
export function refreshBounceThreats(
  bot: Player,
  room: Room,
  grid: AIGrid,
  outList: BounceThreat[],
  horizonS: number
): void {
  outList.length = 0;
  const bcx = bot.position.x + bot.size.w / 2;
  const bcy = bot.position.y + bot.size.h / 2;
  for (let i = 0; i < room.bullets.length && outList.length < 8; i++) {
    const b = room.bullets[i]!;
    const cx = b.position.x + b.size.w / 2;
    const cy = b.position.y + b.size.h / 2;
    if (Math.abs(cx - bcx) > 400 || Math.abs(cy - bcy) > 400) continue;
    // A bullet on its final allowed bounce dies at the wall — no continuation.
    if (b.bounce + 1 >= b.max_bounce) continue;
    const speed = Math.hypot(b.velocity.x, b.velocity.y);
    if (speed < 1) continue;
    const ux = b.velocity.x / speed;
    const uy = b.velocity.y / speed;
    const bulletR = Math.min(b.size.w, b.size.h) / 2;
    const hit = castRay(
      grid,
      cx,
      cy,
      ux,
      uy,
      speed * horizonS,
      bulletR,
      BOUNCE_RAY
    );
    if (!hit) continue;
    const t0 = BOUNCE_RAY.t / speed;
    const rvx = BOUNCE_RAY.axis === 0 ? -b.velocity.x : b.velocity.x;
    const rvy = BOUNCE_RAY.axis === 1 ? -b.velocity.y : b.velocity.y;
    outList.push({
      // Rewind the virtual bullet to t=0 coordinates so the shared CPA form
      // (position + velocity·t) holds on its [t0, t1] window.
      x: BOUNCE_RAY.x - rvx * t0,
      y: BOUNCE_RAY.y - rvy * t0,
      vx: rvx,
      vy: rvy,
      t0,
      t1: horizonS,
    });
  }
}

// Any reachable target outranks every unreachable one (max flow distance on
// the 23x16 grid is well under this).
const UNREACHABLE_PENALTY = 1000;

// Flow-distance-based nearest live enemy (humans, plus lobby bots in FFA
// rooms), with stickiness so the bot doesn't oscillate between two
// equidistant players.
export function pickTarget(
  bot: Player,
  room: Room,
  s: AIRoomState,
  currentId: string | null
): Player | null {
  const bcol = Math.floor((bot.position.x + bot.size.w / 2) / TILE);
  const brow = Math.floor((bot.position.y + bot.size.h / 2) / TILE);
  let best: Player | null = null;
  let bestId: string | null = null;
  let bestScore = Infinity;
  let current: Player | null = null;
  let currentScore = Infinity;

  // s.targets is the allocation-free humans++lobby-bots view kept in sync by
  // refreshPerTick (which every brain tick runs before targeting).
  for (const id of s.targets) {
    if (id === bot.socketid) continue; // a lobby bot is in the target set
    const p = room.players[id];
    if (!p || !p.alive || p.position == undefined) continue;
    const flow = s.flows.get(id);
    let score: number;
    const fd = flow ? flow.distAt(bcol, brow) : FLOW_INF;
    if (fd < FLOW_INF) {
      score = fd;
    } else {
      // Unreachable (sealed-off) humans only matter when NOBODY is reachable:
      // without the penalty a close walled-off player outscores a reachable
      // one (flow tiles vs euclidean tiles are the same scale) and the bot
      // locks onto a target it can neither path to nor engage.
      score =
        UNREACHABLE_PENALTY +
        Math.hypot(
          p.position.x - bot.position.x,
          p.position.y - bot.position.y
        ) /
          TILE;
    }
    if (id === currentId) {
      current = p;
      currentScore = score;
    }
    if (score < bestScore) {
      bestScore = score;
      best = p;
      bestId = id;
    }
  }

  if (current && bestId !== currentId && bestScore >= currentScore * 0.7) {
    return current; // challenger not decisively closer: stay on target
  }
  return best;
}

export function hasLOS(
  grid: AIGrid,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): boolean {
  return segmentClear(grid, x0, y0, x1, y1, 4);
}
