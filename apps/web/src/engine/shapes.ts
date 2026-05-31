// Shared "diep.io arcade" canvas drawing primitives — the SINGLE source of
// truth for the field, blocks, holes, spawn flags and tanks. Both the in-game
// Renderer and the LevelEditor import these, so the editor preview is drawn by
// the exact same code that draws the live game (no drift).
import { palette } from "../theme/palette";
import { drawTank } from "./tankShape";

export { drawTank };

const INK = palette.ink;
const WALL_FILL = "#7d848e";
const PLATFORM_FILL = "#cbb287";

export interface BlockShape {
  position: { x: number; y: number };
  size: { w: number; h: number };
  /** 1 = wall, 2 = platform */
  type: number;
}

export interface HoleShape {
  position: { x: number; y: number };
  size: { w: number; h: number };
}

/** Light graph-paper field: solid fill + faint grid lines at `cell` spacing. */
export function paintField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cell: number
): void {
  ctx.fillStyle = palette.field;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.strokeStyle = palette.fieldLine;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += cell) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += cell) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Wall/platform tiles that merge into one solid shape: flush fills (so adjacent
 * same-type cells tile seamlessly) + a thick ink outline only on edges that
 * face empty space (or a different type).
 */
export function drawBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: BlockShape[]
): void {
  const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const occ = new Map<string, number>();
  for (const b of blocks) occ.set(key(b.position.x, b.position.y), b.type);

  // Pass 1 — flush fills.
  for (const b of blocks) {
    ctx.fillStyle = b.type === 1 ? WALL_FILL : PLATFORM_FILL;
    ctx.fillRect(b.position.x, b.position.y, b.size.w, b.size.h);
  }

  // Pass 2 — ink outline on exposed edges only.
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.lineCap = "square";
  for (const b of blocks) {
    const { x, y } = b.position;
    const { w, h } = b.size;
    const t = b.type;
    const has = (nx: number, ny: number) => occ.get(key(nx, ny)) === t;
    ctx.beginPath();
    if (!has(x, y - h)) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
    }
    if (!has(x + w, y)) {
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w, y + h);
    }
    if (!has(x, y + h)) {
      ctx.moveTo(x + w, y + h);
      ctx.lineTo(x, y + h);
    }
    if (!has(x - w, y)) {
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Near-black rounded pit with a thick ink rim. */
export function drawHole(ctx: CanvasRenderingContext2D, h: HoleShape): void {
  const r = Math.min(h.size.w, h.size.h) * 0.18;
  ctx.beginPath();
  ctx.roundRect(h.position.x, h.position.y, h.size.w, h.size.h, r);
  ctx.fillStyle = "#13161b";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

/** Spawn-point marker — a little yellow pennant on an ink pole (editor only). */
export function drawFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number
): void {
  const px = x + s * 0.34;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px, y + s * 0.2);
  ctx.lineTo(px, y + s * 0.82);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px, y + s * 0.22);
  ctx.lineTo(x + s * 0.74, y + s * 0.36);
  ctx.lineTo(px, y + s * 0.5);
  ctx.closePath();
  ctx.fillStyle = palette.yellow;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
