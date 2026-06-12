import {
  ARCHETYPES,
  type AIBotKind,
  type Archetype,
  type ArchetypeAI,
} from "./archetypes.js";
import {
  MINE_BLAST_OFFSET,
  MINE_BLAST_R,
  TILE,
  COLS,
  ROWS,
  DIR8_X,
  DIR8_Y,
  angleDiff,
  cellIdx,
} from "./constants.js";
import { isMoveBlockedAtPx } from "./grid.js";
import { FLOW_INF, FlowField } from "./flow.js";
import {
  ThreatSummary,
  hasLOS,
  pickTarget,
  refreshBounceThreats,
  senseThreats,
  type BounceThreat,
} from "./perception.js";
import {
  getAIRoomState,
  refreshPerTick,
  type AIRoomState,
} from "./room_state.js";
import {
  ShotSolution,
  desiredAngleFor,
  refreshSolution,
  validateAim,
} from "./targeting.js";
import {
  committedDirBlocked,
  resetIntent,
  solveSteering,
  type Intent,
  type SteerState,
} from "./steering.js";
import { Rng } from "./rng.js";
import type { Room } from "../Room.js";
import type { Player } from "../Player.js";

// The per-bot decision core: a small FSM choosing an intent, context steering
// executing it, targeting producing firing solutions, and a mine policy. All
// stochastic choices draw from the seeded per-bot Rng — never Math.random —
// so pinned seeds reproduce behaviour exactly.

export const STATE = {
  Idle: 0,
  Wander: 1,
  Hunt: 2,
  Engage: 3,
  Evade: 4,
  PostMine: 5,
} as const;
export type AIState = (typeof STATE)[keyof typeof STATE];

// FSM thresholds (state entry/exit and fire-control shaping).
const EVADE_ENTER_URGENCY = 0.35;
const EVADE_ENTER_MINE = 0.5;
const EVADE_EXIT_URGENCY = 0.15;
const EVADE_EXIT_HOLD_TICKS = 12;
const LOS_LOST_TO_HUNT_TICKS = 30;
const IMMINENT_TCPA_S = 0.35;
const RESTEER_MIN_GAP_TICKS = 3;
const QUALITY_PER_BULLET = 0.25; // each bullet in flight raises the shot bar
const PANIC_DIST = 140;
const PANIC_COOLDOWN_FACTOR = 0.4;
const PANIC_TOL_FACTOR = 3;
const SOLUTION_STALE_TICKS = 18;

// Mine policy gates.
const MINE_MIN_SPACING = 170; // no plant near an existing blast centre
const MINE_FRIENDLY_CLEAR = 140;
const MINE_ESCAPE_NEAR = 60;
const MINE_ESCAPE_FAR = 110;
const POST_MINE_HOLD_TICKS = 60;
const POST_MINE_CLEAR_DIST = MINE_BLAST_R + 45;
const FLEE_DROP_DIST = 250;
const CHOKE_FLOW_DIST = 8;
const BREACH_FLOW_DIST = 40;

export class Brain {
  rng: Rng;
  state: AIState = STATE.Idle;
  stateSince = 0;
  threat = new ThreatSummary();
  bounceThreats: BounceThreat[] = [];
  solution = new ShotSolution();
  turretWorld = 0;
  desiredWorld = 0;
  scanDir: 1 | -1 = 1;
  targetId: string | null = null;
  steer: SteerState = { curDirIdx: 8, lastDirChange: -1e9 };
  lastSteerSolve = -1e9;
  wasUrgent = false;
  lowUrgencySince = -1;
  losLostSince = -1;
  strafeSign: 1 | -1 = 1;
  nextStrafeFlip = 0;
  headOnSign: 1 | -1 = 1;
  lastShotTick = -1e9;
  lastMineTick = -1e9;
  postMineUntil = -1;
  mineX = 0;
  mineY = 0;
  fan = { phase: 0 };
  intent: Intent = {
    seekX: 0,
    seekY: 0,
    seekW: 0,
    strafeX: 0,
    strafeY: 0,
    strafeW: 0,
    allowStop: true,
  };
  wanderX = 0;
  wanderY = 0;
  wanderUntil = -1;
  seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
  }

  // Fresh round (Player.spawn): forget everything but keep the same seed so a
  // respawned bot replays deterministically under a pinned room seed.
  reset(): void {
    this.rng = new Rng(this.seed);
    this.state = STATE.Idle;
    this.stateSince = 0;
    this.threat.reset();
    this.bounceThreats.length = 0;
    this.solution.clear();
    this.turretWorld = 0;
    this.desiredWorld = 0;
    this.scanDir = 1;
    this.targetId = null;
    this.steer.curDirIdx = 8;
    this.steer.lastDirChange = -1e9;
    this.lastSteerSolve = -1e9;
    this.wasUrgent = false;
    this.lowUrgencySince = -1;
    this.losLostSince = -1;
    this.strafeSign = 1;
    this.nextStrafeFlip = 0;
    this.headOnSign = 1;
    this.lastShotTick = -1e9;
    this.lastMineTick = -1e9;
    this.postMineUntil = -1;
    this.fan.phase = 0;
    this.wanderUntil = -1;
  }
}

const FLOW_DIR = { x: 0, y: 0 };

function centerX(p: Player): number {
  return p.position.x + p.size.w / 2;
}
function centerY(p: Player): number {
  return p.position.y + p.size.h / 2;
}

// One simulation tick of decisions for `bot`. Runs BEFORE Player.update so a
// dodge chosen here moves the tank against this tick's bullet positions.
export function brainTick(
  bot: Player,
  kind: AIBotKind,
  brain: Brain,
  room: Room,
  dt: number
): void {
  const arch: Archetype = ARCHETYPES[kind];
  const ai = arch.ai;
  const s = getAIRoomState(room);
  refreshPerTick(room, s);

  const tick = room.tick;
  const canMove = arch.chassis.canMove;

  // -- sense (every tick; cheap CPA + mine scan) --
  const postMineActive = tick < brain.postMineUntil;
  if (canMove) {
    senseThreats(
      bot,
      room,
      brain.threat,
      ai,
      brain.headOnSign,
      brain.bounceThreats,
      postMineActive
    );
    if (brain.threat.urgency < 0.05 && brain.rng.next() < 0.02) {
      // re-roll the head-on dodge side occasionally while calm
      brain.headOnSign = brain.rng.sign();
    }
  }

  const target = pickTarget(bot, room, s, brain.targetId);
  brain.targetId = target ? target.socketid : null;
  if (target && brain.solution.kind !== 0) {
    if (
      brain.solution.targetId !== target.socketid ||
      brain.solution.geometryVersion !== s.grid.version ||
      tick - brain.solution.lastValidTick > SOLUTION_STALE_TICKS
    ) {
      brain.solution.clear();
    }
  } else if (!target) {
    brain.solution.clear();
  }

  // -- think (staggered cadence) --
  const offset = brain.seed % ai.thinkPeriod;
  if ((tick + offset) % ai.thinkPeriod === 0) {
    think(bot, brain, room, s, arch, target, tick);
  } else if (canMove) {
    // Out-of-band re-steer: a threat just crossed the line, something is
    // about to hit us, or our committed direction got blocked (shoved).
    const urgent =
      brain.threat.urgency >= EVADE_ENTER_URGENCY ||
      brain.threat.mineUrgency >= EVADE_ENTER_MINE;
    const trigger =
      (urgent && !brain.wasUrgent) ||
      brain.threat.imminentTCPA < IMMINENT_TCPA_S ||
      committedDirBlocked(bot, s.grid, brain.steer);
    if (trigger && tick - brain.lastSteerSolve >= RESTEER_MIN_GAP_TICKS) {
      if (urgent && brain.state !== STATE.Evade) {
        enterState(brain, STATE.Evade, tick);
      }
      buildIntent(bot, brain, room, s, arch, target, tick);
      solveSteering(
        bot,
        room,
        s.grid,
        brain.threat,
        brain.intent,
        brain.steer,
        tick,
        true
      );
      brain.lastSteerSolve = tick;
    }
    brain.wasUrgent = urgent;
  }

  // -- aim (every tick) --
  const ema = target ? s.velEMA.get(target.socketid) : undefined;
  const tvx = ema ? ema.vx : 0;
  const tvy = ema ? ema.vy : 0;
  if (brain.solution.kind !== 0 && target) {
    brain.desiredWorld = desiredAngleFor(
      bot,
      target,
      tvx,
      tvy,
      ai,
      brain.solution,
      brain.desiredWorld
    );
  } else if (target) {
    // No firing solution: track the target anyway (turret-seek feel).
    brain.desiredWorld = Math.atan2(
      centerY(target) - centerY(bot),
      centerX(target) - centerX(bot)
    );
  } else {
    // Idle scan sweep.
    brain.desiredWorld =
      brain.turretWorld + brain.scanDir * ai.idleScanRadS * dt * 2;
    if (brain.rng.next() < 0.005) brain.scanDir = brain.rng.sign();
  }

  const maxStep = ai.turretSlewRadS * dt;
  const diff = angleDiff(brain.turretWorld, brain.desiredWorld);
  if (diff > maxStep) brain.turretWorld += maxStep;
  else if (diff < -maxStep) brain.turretWorld -= maxStep;
  else brain.turretWorld = brain.desiredWorld;
  // THE legacy-convention boundary: Player/Bullet treat `angle` as the
  // direction whose NEGATIVE cosine/sine the bullet flies along.
  bot.angle = brain.turretWorld + Math.PI;

  // -- fire (every tick) --
  if (target && bot.bulletcount < bot.max_bulletcount) {
    const sol = brain.solution;
    const aligned = Math.abs(angleDiff(brain.turretWorld, brain.desiredWorld));
    const cooldownOk = tick - brain.lastShotTick >= ai.cooldownTicks;
    if (
      sol.kind !== 0 &&
      cooldownOk &&
      aligned <= ai.aimTolRad &&
      tick - sol.acquiredTick >= ai.reactionTicks &&
      sol.quality >= ai.minQuality + QUALITY_PER_BULLET * bot.bulletcount &&
      sol.geometryVersion === s.grid.version &&
      validateAim(s.grid, bot, room, target, brain.turretWorld, ai, sol)
    ) {
      fire(bot, brain, room, ai);
    } else if (
      tick - brain.lastShotTick >=
      ai.cooldownTicks * PANIC_COOLDOWN_FACTOR
    ) {
      // Point-blank pressure: someone is on top of us with clear LOS.
      const dx = centerX(target) - centerX(bot);
      const dy = centerY(target) - centerY(bot);
      if (dx * dx + dy * dy < PANIC_DIST * PANIC_DIST) {
        const toTarget = Math.atan2(dy, dx);
        if (
          Math.abs(angleDiff(brain.turretWorld, toTarget)) <=
            ai.aimTolRad * PANIC_TOL_FACTOR &&
          hasLOS(
            s.grid,
            centerX(bot),
            centerY(bot),
            centerX(target),
            centerY(target)
          )
        ) {
          fire(bot, brain, room, ai);
        }
      }
    }
  }
}

function fire(bot: Player, brain: Brain, room: Room, ai: ArchetypeAI): void {
  // Aim error is sampled ONCE per shot (no wobble): nudge the turret for the
  // single shoot() call, then restore the tracking pose.
  const err = ai.aimSigmaRad * brain.rng.gaussian();
  bot.angle = brain.turretWorld + err + Math.PI;
  bot.shoot(room); // AIBot.shoot stamps brain.lastShotTick
  bot.angle = brain.turretWorld + Math.PI;
}

function enterState(brain: Brain, next: AIState, tick: number): void {
  if (brain.state === next) return;
  brain.state = next;
  brain.stateSince = tick;
}

// Full decision pass (think cadence).
function think(
  bot: Player,
  brain: Brain,
  room: Room,
  s: AIRoomState,
  arch: Archetype,
  target: Player | null,
  tick: number
): void {
  const ai = arch.ai;
  const canMove = arch.chassis.canMove;

  // ---- targeting refresh ----
  if (target) {
    const ema = s.velEMA.get(target.socketid);
    const prevKind = brain.solution.kind;
    const prevAcquired = brain.solution.acquiredTick;
    refreshSolution(
      s.grid,
      bot,
      room,
      target,
      ema ? ema.vx : 0,
      ema ? ema.vy : 0,
      ai,
      brain.solution,
      brain.fan
    );
    if (brain.solution.kind !== 0) {
      brain.solution.lastValidTick = tick;
      // Keep the reaction clock running across refreshes of a held solution;
      // restart it when a solution (re)appears.
      brain.solution.acquiredTick = prevKind !== 0 ? prevAcquired : tick;
    }
  }

  if (!canMove) {
    enterState(brain, target ? STATE.Engage : STATE.Idle, tick);
    return;
  }

  // Post-bounce continuations for the per-tick CPA (dodgers only).
  if (ai.bounceAwareDodge) {
    refreshBounceThreats(
      bot,
      room,
      s.grid,
      brain.bounceThreats,
      ai.threatHorizonS
    );
  } else if (brain.bounceThreats.length > 0) {
    brain.bounceThreats.length = 0;
  }

  // ---- FSM ----
  const urgent =
    brain.threat.urgency >= EVADE_ENTER_URGENCY ||
    brain.threat.mineUrgency >= EVADE_ENTER_MINE;

  if (!target) {
    enterState(brain, STATE.Idle, tick);
  } else if (
    brain.state === STATE.PostMine &&
    (tick < brain.postMineUntil ||
      Math.hypot(
        centerX(bot) - (brain.mineX + MINE_BLAST_OFFSET),
        centerY(bot) - (brain.mineY + MINE_BLAST_OFFSET)
      ) < POST_MINE_CLEAR_DIST)
  ) {
    // stay until the blast zone is genuinely cleared
  } else if (urgent) {
    enterState(brain, STATE.Evade, tick);
    brain.lowUrgencySince = -1;
  } else if (brain.state === STATE.Evade) {
    if (
      brain.threat.urgency < EVADE_EXIT_URGENCY &&
      brain.threat.mineUrgency < EVADE_EXIT_URGENCY * 2
    ) {
      if (brain.lowUrgencySince < 0) brain.lowUrgencySince = tick;
      if (tick - brain.lowUrgencySince >= EVADE_EXIT_HOLD_TICKS) {
        enterState(brain, STATE.Engage, tick);
      }
    } else {
      brain.lowUrgencySince = -1;
    }
  } else {
    const los = hasLOS(
      s.grid,
      centerX(bot),
      centerY(bot),
      centerX(target),
      centerY(target)
    );
    if (los) {
      brain.losLostSince = -1;
      enterState(brain, STATE.Engage, tick);
    } else {
      if (brain.losLostSince < 0) brain.losLostSince = tick;
      if (tick - brain.losLostSince > LOS_LOST_TO_HUNT_TICKS) {
        const flow = s.flows.get(target.socketid);
        const bcol = Math.floor(centerX(bot) / TILE);
        const brow = Math.floor(centerY(bot) / TILE);
        if (flow && flow.distAt(bcol, brow) < FLOW_INF) {
          enterState(brain, STATE.Hunt, tick);
        } else {
          enterState(brain, STATE.Wander, tick);
        }
      }
    }
  }

  // ---- strafe rhythm ----
  if (tick >= brain.nextStrafeFlip) {
    brain.strafeSign = brain.rng.sign();
    brain.nextStrafeFlip = tick + Math.floor(brain.rng.range(90, 180));
  }

  // ---- intent + steering ----
  buildIntent(bot, brain, room, s, arch, target, tick);
  solveSteering(
    bot,
    room,
    s.grid,
    brain.threat,
    brain.intent,
    brain.steer,
    tick,
    false
  );
  brain.lastSteerSolve = tick;

  // ---- mines ----
  if (ai.minesEnabled && target) {
    maybePlantMine(bot, brain, room, s, ai, target, tick);
  }
}

function buildIntent(
  bot: Player,
  brain: Brain,
  room: Room,
  s: AIRoomState,
  arch: Archetype,
  target: Player | null,
  tick: number
): void {
  const intent = brain.intent;
  resetIntent(intent);
  const ai = arch.ai;
  const bcx = centerX(bot);
  const bcy = centerY(bot);
  const bcol = Math.floor(bcx / TILE);
  const brow = Math.floor(bcy / TILE);

  switch (brain.state) {
    case STATE.Idle:
      return;

    case STATE.Wander: {
      if (
        tick >= brain.wanderUntil ||
        Math.hypot(brain.wanderX - bcx, brain.wanderY - bcy) < TILE
      ) {
        pickWanderPoint(bot, brain, s, tick);
      }
      const dx = brain.wanderX - bcx;
      const dy = brain.wanderY - bcy;
      const len = Math.hypot(dx, dy) || 1;
      intent.seekX = dx / len;
      intent.seekY = dy / len;
      intent.seekW = 1;
      intent.allowStop = false;
      return;
    }

    case STATE.Hunt: {
      if (target) {
        const flow = s.flows.get(target.socketid);
        if (flow && flow.downhillDir(bcol, brow, FLOW_DIR)) {
          intent.seekX = FLOW_DIR.x;
          intent.seekY = FLOW_DIR.y;
          intent.seekW = 1;
          intent.allowStop = false;
          return;
        }
      }
      pickWanderPoint(bot, brain, s, tick);
      brain.state = STATE.Wander;
      return;
    }

    case STATE.Engage: {
      if (!target) return;
      const dx = centerX(target) - bcx;
      const dy = centerY(target) - bcy;
      const dist = Math.hypot(dx, dy) || 1;
      const tx = dx / dist;
      const ty = dy / dist;
      const mid = (ai.bandMinPx + ai.bandMaxPx) / 2;
      const half = Math.max((ai.bandMaxPx - ai.bandMinPx) / 2, 1);
      let k = (dist - mid) / half;
      if (k > 1) k = 1;
      if (k < -1) k = -1;
      // k > 0: outside the band, press in; k < 0: too close, kite away.
      intent.seekX = tx * k;
      intent.seekY = ty * k;
      intent.seekW = Math.abs(k);
      intent.strafeX = -ty * brain.strafeSign;
      intent.strafeY = tx * brain.strafeSign;
      intent.strafeW = 0.7;
      intent.allowStop = Math.abs(k) < 0.3;
      return;
    }

    case STATE.Evade: {
      const ts = brain.threat;
      let ex = ts.dodgeX + ts.mineAwayX;
      let ey = ts.dodgeY + ts.mineAwayY;
      const len = Math.hypot(ex, ey);
      if (len > 1e-6) {
        ex /= len;
        ey /= len;
      }
      intent.seekX = ex;
      intent.seekY = ey;
      intent.seekW = 1.4;
      intent.allowStop = false;
      return;
    }

    case STATE.PostMine: {
      const dx = bcx - (brain.mineX + MINE_BLAST_OFFSET);
      const dy = bcy - (brain.mineY + MINE_BLAST_OFFSET);
      const len = Math.hypot(dx, dy) || 1;
      intent.seekX = dx / len;
      intent.seekY = dy / len;
      intent.seekW = 1.3;
      intent.allowStop = false;
      return;
    }
  }
}

function pickWanderPoint(
  bot: Player,
  brain: Brain,
  s: AIRoomState,
  tick: number
): void {
  const bcol = Math.floor(centerX(bot) / TILE);
  const brow = Math.floor(centerY(bot) / TILE);
  for (let i = 0; i < 10; i++) {
    const col = bcol + brain.rng.int(17) - 8;
    const row = brow + brain.rng.int(17) - 8;
    if (col < 1 || col >= COLS - 1 || row < 1 || row >= ROWS) continue;
    const d = Math.hypot(col - bcol, row - brow);
    if (d < 4 || d > 8) continue;
    if (s.grid.move[cellIdx(col, row)]!) continue;
    brain.wanderX = col * TILE + TILE / 2;
    brain.wanderY = row * TILE + TILE / 2;
    brain.wanderUntil = tick + Math.floor(brain.rng.range(120, 240));
    return;
  }
  // Nothing suitable: hold position briefly and retry next think.
  brain.wanderX = centerX(bot);
  brain.wanderY = centerY(bot);
  brain.wanderUntil = tick + 30;
}

function maybePlantMine(
  bot: Player,
  brain: Brain,
  room: Room,
  s: AIRoomState,
  ai: ArchetypeAI,
  target: Player,
  tick: number
): void {
  if (bot.minecount >= bot.max_minecount) return;
  if (tick - brain.lastMineTick < ai.mineCooldownTicks) return;
  if (brain.threat.urgency >= 0.2) return;
  if (brain.state === STATE.PostMine) return;

  const bcx = centerX(bot);
  const bcy = centerY(bot);

  // Spacing vs every existing blast centre (a chain would just waste both).
  for (let i = 0; i < room.mines.length; i++) {
    const m = room.mines[i]!;
    if (
      Math.hypot(
        bcx - (m.position.x + MINE_BLAST_OFFSET),
        bcy - (m.position.y + MINE_BLAST_OFFSET)
      ) < MINE_MIN_SPACING
    ) {
      return;
    }
  }
  // Never sacrifice a teammate to the 5s fuse.
  for (const socketid in room.players) {
    if (!socketid.includes("bot")) continue;
    const other = room.players[socketid];
    if (!other || other === bot || !other.alive || other.position == undefined)
      continue;
    if (
      Math.hypot(centerX(other) - bcx, centerY(other) - bcy) <
      MINE_FRIENDLY_CLEAR
    ) {
      return;
    }
  }
  const bcol = Math.floor(bcx / TILE);
  const brow = Math.floor(bcy / TILE);
  const flow = s.flows.get(target.socketid);
  const flowDist = flow ? flow.distAt(bcol, brow) : FLOW_INF;

  let plant = false;

  // Breach: sealed off from the target and standing next to a mine-destructible
  // (type-2) wall — blow a path open. This is how a hunter escapes a pocket.
  // Its safety gate differs from the open-field one: inside a pocket no
  // direction has 110 px of clear ground, so instead require a REACHABLE cell
  // far enough from the blast centre to survive the fuse (otherwise planting
  // is suicide and the bot correctly refuses).
  if (ai.breachEnabled && flowDist >= BREACH_FLOW_DIST) {
    const blastX = bcx + MINE_BLAST_OFFSET;
    const blastY = bcy + MINE_BLAST_OFFSET;
    let wallInRange = false;
    outer: for (
      let r = Math.max(0, brow - 2);
      r <= Math.min(ROWS - 1, brow + 2);
      r++
    ) {
      for (
        let c = Math.max(0, bcol - 2);
        c <= Math.min(COLS - 1, bcol + 2);
        c++
      ) {
        if (s.grid.wallType[cellIdx(c, r)]! !== 2) continue;
        const wx = c * TILE + TILE / 2;
        const wy = r * TILE + TILE / 2;
        if (Math.hypot(blastX - wx, blastY - wy) <= MINE_BLAST_R) {
          wallInRange = true;
          break outer;
        }
      }
    }
    if (wallInRange && breachEscapeExists(s, bcol, brow, blastX, blastY)) {
      plant = true;
    }
  }

  // Open-field triggers share the directional escape gate: one low-danger
  // direction with clear ground at 60/110 px (0.7 s of travel beats the 5 s
  // fuse with a wide margin; a boxed-in bot never plants).
  if (!plant) {
    let escape = false;
    for (let i = 0; i < 8 && !escape; i++) {
      if (brain.threat.dirDanger[i]! >= 0.5) continue;
      const ex = DIR8_X[i]!;
      const ey = DIR8_Y[i]!;
      if (
        isMoveBlockedAtPx(
          s.grid,
          bcx + ex * MINE_ESCAPE_NEAR,
          bcy + ey * MINE_ESCAPE_NEAR
        )
      )
        continue;
      if (
        isMoveBlockedAtPx(
          s.grid,
          bcx + ex * MINE_ESCAPE_FAR,
          bcy + ey * MINE_ESCAPE_FAR
        )
      )
        continue;
      escape = true;
    }

    if (escape) {
      // Chokepoint on the target's approach path.
      if (
        s.grid.corridor[cellIdx(bcol, brow)]! === 1 &&
        flowDist <= CHOKE_FLOW_DIST &&
        brain.rng.next() < ai.chokeP
      ) {
        plant = true;
      }

      // Flee-drop: the TARGET is bearing down on us (its own velocity closes
      // the gap — not ours; approaching a parked player is not a pursuit).
      if (!plant) {
        const dx = centerX(target) - bcx;
        const dy = centerY(target) - bcy;
        const dist = Math.hypot(dx, dy);
        if (dist < FLEE_DROP_DIST && dist > 1) {
          const closingSpeed =
            (target.velocity.x * -dx + target.velocity.y * -dy) / dist;
          if (closingSpeed > 60 && brain.rng.next() < ai.fleeDropP) {
            plant = true;
          }
        }
      }
    }
  }

  if (!plant) return;
  bot.plant(room);
  brain.lastMineTick = tick;
  brain.mineX = bcx;
  brain.mineY = bcy;
  brain.postMineUntil = tick + POST_MINE_HOLD_TICKS;
  enterState(brain, STATE.PostMine, tick);
}

// Reachability flood from the bot's own cell, computed only when a breach
// plant is actually being considered (rare). Shared scratch field.
const BREACH_FLOW = new FlowField();
const BREACH_SAFE_DIST = MINE_BLAST_R + 15;
const BREACH_REACH_TILES = 5;

function breachEscapeExists(
  s: AIRoomState,
  bcol: number,
  brow: number,
  blastX: number,
  blastY: number
): boolean {
  BREACH_FLOW.compute(s.grid, bcol, brow);
  const r0 = Math.max(0, brow - BREACH_REACH_TILES);
  const r1 = Math.min(ROWS - 1, brow + BREACH_REACH_TILES);
  const c0 = Math.max(0, bcol - BREACH_REACH_TILES);
  const c1 = Math.min(COLS - 1, bcol + BREACH_REACH_TILES);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (BREACH_FLOW.distAt(c, r) > BREACH_REACH_TILES) continue;
      const cx = c * TILE + TILE / 2;
      const cy = r * TILE + TILE / 2;
      if (Math.hypot(cx - blastX, cy - blastY) >= BREACH_SAFE_DIST) {
        return true;
      }
    }
  }
  return false;
}
