// Shared "diep.io arcade" canvas drawing primitives — the SINGLE source of
// truth for the field, blocks, holes, spawn flags and tanks. Both the in-game
// Renderer and the LevelEditor import these, so the editor preview is drawn by
// the exact same code that draws the live game (no drift).
import { palette, mixHex } from "../theme/palette";
import { drawTank } from "./tankShape";

export { drawTank };

const INK = palette.ink;
const WALL_FILL = "#7d848e";
const PLATFORM_FILL = "#cbb287";

// Corner radius (board px) for the rounded look that matches the DOM UI
// (--radius-arcade). Only *convex* corners of a merged wall region are rounded;
// it's clamped per block to half the smaller side so thin tiles stay sane. The
// WebGL wall shader (postfx/shaders.ts) uses the same value.
export const BLOCK_RADIUS = 10;

// Lighter floor than the raw palette field, so the in-game board reads whiter.
// Mirrors the WebGL field shader's WHITEN toward white.
const FIELD_WHITEN = 0.6;

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
  ctx.fillStyle = mixHex(palette.field, "#ffffff", FIELD_WHITEN);
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
 *
 * A tile corner is *convex* (and so gets a rounded radius) only when both of the
 * two edges meeting there are exposed; interior corners stay sharp so merged
 * runs read as one rounded slab and the ink follows the rounded perimeter with
 * no gap where two exposed edges meet.
 */
export function drawBlocks(
  ctx: CanvasRenderingContext2D,
  blocks: BlockShape[]
): void {
  const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`;
  const occ = new Map<string, number>();
  for (const b of blocks) occ.set(key(b.position.x, b.position.y), b.type);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const b of blocks) {
    const { x, y } = b.position;
    const { w, h } = b.size;
    const t = b.type;
    const has = (nx: number, ny: number) => occ.get(key(nx, ny)) === t;
    // Exposed edges (no same-type neighbour on that side).
    const top = !has(x, y - h);
    const right = !has(x + w, y);
    const bottom = !has(x, y + h);
    const left = !has(x - w, y);
    // Convex corners round; clamp radius to the tile so thin tiles stay valid.
    const r = Math.min(BLOCK_RADIUS, w / 2, h / 2);
    const rTL = top && left ? r : 0;
    const rTR = top && right ? r : 0;
    const rBR = bottom && right ? r : 0;
    const rBL = bottom && left ? r : 0;
    const x0 = x;
    const y0 = y;
    const x1 = x + w;
    const y1 = y + h;

    // Fill: the tile with convex corners rounded.
    ctx.beginPath();
    ctx.moveTo(x0 + rTL, y0);
    ctx.lineTo(x1 - rTR, y0);
    if (rTR) ctx.arcTo(x1, y0, x1, y0 + rTR, rTR);
    ctx.lineTo(x1, y1 - rBR);
    if (rBR) ctx.arcTo(x1, y1, x1 - rBR, y1, rBR);
    ctx.lineTo(x0 + rBL, y1);
    if (rBL) ctx.arcTo(x0, y1, x0, y1 - rBL, rBL);
    ctx.lineTo(x0, y0 + rTL);
    if (rTL) ctx.arcTo(x0, y0, x0 + rTL, y0, rTL);
    ctx.closePath();
    ctx.fillStyle = t === 1 ? WALL_FILL : PLATFORM_FILL;
    ctx.fill();

    // Ink outline: only the exposed edges, joined through the rounded corners.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (top) {
      ctx.moveTo(x0 + rTL, y0);
      ctx.lineTo(x1 - rTR, y0);
      if (rTR) ctx.arcTo(x1, y0, x1, y0 + rTR, rTR);
    }
    if (right) {
      ctx.moveTo(x1, y0 + rTR);
      ctx.lineTo(x1, y1 - rBR);
      if (rBR) ctx.arcTo(x1, y1, x1 - rBR, y1, rBR);
    }
    if (bottom) {
      ctx.moveTo(x1 - rBR, y1);
      ctx.lineTo(x0 + rBL, y1);
      if (rBL) ctx.arcTo(x0, y1, x0, y1 - rBL, rBL);
    }
    if (left) {
      ctx.moveTo(x0, y1 - rBL);
      ctx.lineTo(x0, y0 + rTL);
      if (rTL) ctx.arcTo(x0, y0, x0 + rTL, y0, rTL);
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
