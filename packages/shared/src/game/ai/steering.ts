import {
  DIR8_X,
  DIR8_Y,
  DIR_STOP,
  DSGN_X,
  DSGN_Y,
  HULL_R,
} from "./constants.js";
import { isMoveBlockedAtPx, type AIGrid } from "./grid.js";
import type { ThreatSummary } from "./perception.js";
import type { Room } from "../Room.js";
import type { Player } from "../Player.js";

// Context steering over the 8 movement directions the chassis can actually
// take (Player.update quantizes direction to signs), plus STOP. Interest
// comes from the brain's intent (seek/strafe vectors), danger from threats,
// walls and friendly separation. Hysteresis keeps motion readable: the bot
// commits to a direction until something meaningfully better appears.

const NEAR_PROBE = HULL_R + 14; // immediate wall contact if we go this way
const FAR_PROBE = HULL_R + 34; // wall coming up — soft penalty
const DANGER_WEIGHT = 1.6;
const SEPARATION_DIST = 70;
const SWITCH_RATIO = 1.15;
const SWITCH_MARGIN = 0.05;
const MIN_DIR_HOLD_TICKS = 8;

export interface Intent {
  seekX: number;
  seekY: number;
  seekW: number;
  strafeX: number;
  strafeY: number;
  strafeW: number;
  allowStop: boolean;
}

export function resetIntent(intent: Intent): void {
  intent.seekX = 0;
  intent.seekY = 0;
  intent.seekW = 0;
  intent.strafeX = 0;
  intent.strafeY = 0;
  intent.strafeW = 0;
  intent.allowStop = true;
}

// Persisted steering commitment (lives on the brain).
export interface SteerState {
  curDirIdx: number; // 0..7 or DIR_STOP
  lastDirChange: number;
}

const scores = new Float64Array(9);

export function solveSteering(
  bot: Player,
  room: Room,
  grid: AIGrid,
  threat: ThreatSummary,
  intent: Intent,
  steer: SteerState,
  tick: number,
  forced: boolean
): void {
  const cx = bot.position.x + bot.size.w / 2;
  const cy = bot.position.y + bot.size.h / 2;

  for (let i = 0; i < 8; i++) {
    const dx = DIR8_X[i]!;
    const dy = DIR8_Y[i]!;
    let interest = 0;
    const seekDot = dx * intent.seekX + dy * intent.seekY;
    if (seekDot > 0) interest += intent.seekW * seekDot;
    const strafeDot = dx * intent.strafeX + dy * intent.strafeY;
    if (strafeDot > 0) interest += intent.strafeW * strafeDot;

    let danger = threat.dirDanger[i]!;
    if (isMoveBlockedAtPx(grid, cx + dx * NEAR_PROBE, cy + dy * NEAR_PROBE)) {
      danger += 1.0;
    } else if (
      isMoveBlockedAtPx(grid, cx + dx * FAR_PROBE, cy + dy * FAR_PROBE)
    ) {
      danger += 0.45;
    }

    scores[i] = interest - DANGER_WEIGHT * danger;
  }

  // Friendly separation: don't clump (the old bots' most visible tic).
  for (const socketid in room.players) {
    if (!socketid.includes("bot")) continue;
    const other = room.players[socketid];
    if (!other || other === bot || !other.alive || other.position == undefined)
      continue;
    const ox = other.position.x + other.size.w / 2 - cx;
    const oy = other.position.y + other.size.h / 2 - cy;
    const d = Math.hypot(ox, oy);
    if (d > SEPARATION_DIST || d < 1e-6) continue;
    const w = 0.6 * (1 - d / SEPARATION_DIST);
    for (let i = 0; i < 8; i++) {
      const toward = (DIR8_X[i]! * ox + DIR8_Y[i]! * oy) / d;
      if (toward > 0) scores[i] = scores[i]! - DANGER_WEIGHT * w * toward;
    }
  }

  scores[DIR_STOP] =
    (intent.allowStop ? 0.05 : -0.2) -
    Math.max(threat.urgency, threat.mineUrgency) * 0.5;

  let best = DIR_STOP;
  let bestScore = scores[DIR_STOP]!;
  for (let i = 0; i < 8; i++) {
    if (scores[i]! > bestScore) {
      bestScore = scores[i]!;
      best = i;
    }
  }

  const cur = steer.curDirIdx;
  let chosen = best;
  if (!forced && cur !== best) {
    const curScore = scores[cur]!;
    const beats =
      bestScore > curScore * SWITCH_RATIO + SWITCH_MARGIN || curScore <= -0.5; // current direction has gone properly bad
    const heldLongEnough = tick - steer.lastDirChange >= MIN_DIR_HOLD_TICKS;
    if (!beats || !heldLongEnough) chosen = cur;
  }

  if (chosen !== steer.curDirIdx) {
    steer.curDirIdx = chosen;
    steer.lastDirChange = tick;
  }

  if (chosen === DIR_STOP) {
    bot.direction.x = 0;
    bot.direction.y = 0;
  } else {
    bot.direction.x = DSGN_X[chosen]!;
    bot.direction.y = DSGN_Y[chosen]!;
  }
}

// Is the bot's committed direction about to hit geometry? (Cheap per-tick
// probe used to trigger an out-of-band re-steer, e.g. after being shoved.)
export function committedDirBlocked(
  bot: Player,
  grid: AIGrid,
  steer: SteerState
): boolean {
  const i = steer.curDirIdx;
  if (i === DIR_STOP) return false;
  const cx = bot.position.x + bot.size.w / 2;
  const cy = bot.position.y + bot.size.h / 2;
  return isMoveBlockedAtPx(
    grid,
    cx + DIR8_X[i]! * NEAR_PROBE,
    cy + DIR8_Y[i]! * NEAR_PROBE
  );
}
