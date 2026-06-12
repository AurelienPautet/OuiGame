import { COLS, ROWS, CELLS } from "./constants.js";
import type { AIGrid } from "./grid.js";

// BFS flow field over the movement grid, one per live human, shared by every
// bot in the room (computed once, read by all — the cheap trick that buys real
// chase-around-walls pathing). 4-neighbour because the 41 px tank hull cannot
// cut diagonal gaps between blocks.

export const FLOW_INF = 32767;

// Module-level ring buffer; the sim is single-threaded and computes never nest.
const queue = new Int32Array(CELLS);

export class FlowField {
  dist = new Int16Array(CELLS); // tiles from the source; FLOW_INF unreachable
  version = -1; // grid.version this field was computed under
  sourceIdx = -1;

  compute(grid: AIGrid, sourceCol: number, sourceRow: number): void {
    const dist = this.dist;
    const move = grid.move;
    dist.fill(FLOW_INF);

    let src = sourceRow * COLS + sourceCol;
    // A source clamped against geometry can sit in a blocked cell; fall back
    // to its first free 4-neighbour so the field still exists.
    if (move[src]!) {
      const c = sourceCol;
      const r = sourceRow;
      if (c + 1 < COLS && !move[src + 1]!) src = src + 1;
      else if (c - 1 >= 0 && !move[src - 1]!) src = src - 1;
      else if (r + 1 < ROWS && !move[src + COLS]!) src = src + COLS;
      else if (r - 1 >= 0 && !move[src - COLS]!) src = src - COLS;
      else {
        this.version = grid.version;
        this.sourceIdx = -1;
        return; // fully sealed source: everything stays unreachable
      }
    }

    dist[src] = 0;
    queue[0] = src;
    let head = 0;
    let tail = 1;
    while (head < tail) {
      const i = queue[head++]!;
      const d = (dist[i]! + 1) as number;
      const c = i % COLS;
      if (c + 1 < COLS && !move[i + 1]! && dist[i + 1]! === FLOW_INF) {
        dist[i + 1] = d;
        queue[tail++] = i + 1;
      }
      if (c - 1 >= 0 && !move[i - 1]! && dist[i - 1]! === FLOW_INF) {
        dist[i - 1] = d;
        queue[tail++] = i - 1;
      }
      if (
        i + COLS < CELLS &&
        !move[i + COLS]! &&
        dist[i + COLS]! === FLOW_INF
      ) {
        dist[i + COLS] = d;
        queue[tail++] = i + COLS;
      }
      if (i - COLS >= 0 && !move[i - COLS]! && dist[i - COLS]! === FLOW_INF) {
        dist[i - COLS] = d;
        queue[tail++] = i - COLS;
      }
    }
    this.version = grid.version;
    this.sourceIdx = src;
  }

  distAt(col: number, row: number): number {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return FLOW_INF;
    return this.dist[row * COLS + col]!;
  }

  // Smoothed descent direction (toward the source) at a cell: a weighted sum
  // of the strictly-downhill 4-neighbour offsets, normalized. False when the
  // cell is unreachable or already at the source plateau.
  downhillDir(
    col: number,
    row: number,
    out: { x: number; y: number }
  ): boolean {
    const here = this.distAt(col, row);
    if (here >= FLOW_INF) return false;
    let vx = 0;
    let vy = 0;
    const right = this.distAt(col + 1, row);
    const left = this.distAt(col - 1, row);
    const down = this.distAt(col, row + 1);
    const up = this.distAt(col, row - 1);
    if (right < here) vx += here - right;
    if (left < here) vx -= here - left;
    if (down < here) vy += here - down;
    if (up < here) vy -= here - up;
    const len = Math.hypot(vx, vy);
    if (len < 1e-9) return false;
    out.x = vx / len;
    out.y = vy / len;
    return true;
  }

  // Ascent direction (away from the source), ignoring unreachable neighbours.
  uphillDir(col: number, row: number, out: { x: number; y: number }): boolean {
    const here = this.distAt(col, row);
    if (here >= FLOW_INF) return false;
    let vx = 0;
    let vy = 0;
    const right = this.distAt(col + 1, row);
    const left = this.distAt(col - 1, row);
    const down = this.distAt(col, row + 1);
    const up = this.distAt(col, row - 1);
    if (right > here && right < FLOW_INF) vx += right - here;
    if (left > here && left < FLOW_INF) vx -= left - here;
    if (down > here && down < FLOW_INF) vy += down - here;
    if (up > here && up < FLOW_INF) vy -= up - here;
    const len = Math.hypot(vx, vy);
    if (len < 1e-9) return false;
    out.x = vx / len;
    out.y = vy / len;
    return true;
  }
}
