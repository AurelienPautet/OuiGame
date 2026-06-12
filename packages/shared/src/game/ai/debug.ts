import { MINE_BLAST_OFFSET, MINE_BLAST_R } from "./constants.js";
import { castBounceRay, BouncePath } from "./grid.js";
import { getAIRoomState } from "./room_state.js";
import { STATE, type Brain } from "./brain.js";
import { ARCHETYPES, type AIBotKind } from "./archetypes.js";
import type { Room } from "../Room.js";
import type { Player } from "../Player.js";
import type { DrawingContext } from "../types.js";

// Development overlay, drawn through the engine's existing debug seam
// (Shift toggles renderer.debugVisual, which flows into room.update → here).
// Shows what the brain is thinking: state, committed direction, the planned
// shot path, and mine blast zones.

const STATE_NAMES = ["IDLE", "WANDER", "HUNT", "ENGAGE", "EVADE", "POSTMINE"];
const DEBUG_PATH = new BouncePath();

export function drawBrainDebug(
  ctx: DrawingContext,
  bot: Player,
  kind: AIBotKind,
  brain: Brain,
  room: Room
): void {
  const cx = bot.position.x + bot.size.w / 2;
  const cy = bot.position.y + bot.size.h / 2;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "black";
  ctx.font = "12px monospace";
  ctx.fillText(
    `${STATE_NAMES[brain.state] ?? "?"} q${brain.solution.quality.toFixed(2)}`,
    cx - 30,
    cy - 36
  );

  // Committed movement direction.
  if (bot.direction.x !== 0 || bot.direction.y !== 0) {
    const len = Math.hypot(bot.direction.x, bot.direction.y) || 1;
    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(
      cx + (bot.direction.x / len) * 40,
      cy + (bot.direction.y / len) * 40
    );
    ctx.stroke();
  }

  // Planned shot path (re-cast along the cached solution angle).
  if (brain.solution.kind !== 0) {
    const grid = getAIRoomState(room).grid;
    const ang = brain.solution.worldAngle;
    castBounceRay(
      grid,
      cx + 45 * Math.cos(ang),
      cy + 45 * Math.sin(ang),
      Math.cos(ang),
      Math.sin(ang),
      ARCHETYPES[kind].ai.maxPlanBounces,
      1400,
      bot.bullet_size.w / 2,
      DEBUG_PATH
    );
    ctx.strokeStyle = brain.solution.kind === 1 ? "red" : "purple";
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(DEBUG_PATH.xs[0]!, DEBUG_PATH.ys[0]!);
    for (let i = 1; i < DEBUG_PATH.n; i++) {
      ctx.lineTo(DEBUG_PATH.xs[i]!, DEBUG_PATH.ys[i]!);
    }
    ctx.stroke();
  }

  // Mine blast zones (engine-accurate centre offset).
  ctx.strokeStyle = "orange";
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < room.mines.length; i++) {
    const m = room.mines[i]!;
    ctx.beginPath();
    ctx.arc(
      m.position.x + MINE_BLAST_OFFSET,
      m.position.y + MINE_BLAST_OFFSET,
      MINE_BLAST_R,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  ctx.restore();
}

export { STATE };
