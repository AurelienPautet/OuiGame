// Fixtures for the v2 bot AI suites. Like fixtures/levels.ts this file is
// imported as a helper, never collected as a suite.
//
// All arenas carry a full border ring of solid walls (row 0, row 15, col 0,
// col 22) like every real level, so bullets bounce at the map edge.

import { GRID_COLS, GRID_ROWS, makeGrid } from "./levels.js";

type Cell = [number, number, number];

function withBorder(cells: Cell[] = []): number[] {
  const ring: Cell[] = [];
  for (let c = 0; c < GRID_COLS; c++) {
    ring.push([0, c, 1], [GRID_ROWS - 1, c, 1]);
  }
  for (let r = 1; r < GRID_ROWS - 1; r++) {
    ring.push([r, 0, 1], [r, GRID_COLS - 1, 1]);
  }
  return makeGrid([...ring, ...cells] as never);
}

// Open field: border only, one human spawn, one spawn per mobile bot kind.
export const openArena = withBorder([
  [8, 4, 12], // bot2
  [8, 18, 3], // human
]);

// A vertical interior wall (col 11, rows 4..11) splitting the middle — direct
// LOS between (8,4) and (8,18) is blocked, 1-bounce shots over the top/bottom
// gaps exist. Used by the golden bullet cross-check and bank-shot tests.
export const bankWallArena = withBorder([
  [4, 11, 1],
  [5, 11, 1],
  [6, 11, 1],
  [7, 11, 1],
  [8, 11, 1],
  [9, 11, 1],
  [10, 11, 1],
  [11, 11, 1],
]);

// Full wall line with a single gap at row 12 — the only path is around the
// bottom: real maze pathing required (no LOS, no 1-bounce).
export const mazeArena = withBorder([
  [1, 11, 1],
  [2, 11, 1],
  [3, 11, 1],
  [4, 11, 1],
  [5, 11, 1],
  [6, 11, 1],
  [7, 11, 1],
  [8, 11, 1],
  [9, 11, 1],
  [10, 11, 1],
  [11, 11, 1],
  // gap at rows 12..13
  [14, 11, 1],
  [3, 3, 12], // bot2 on the left
  [3, 18, 3], // human on the right
]);

// bot3 (breach-enabled) sealed inside a pocket of type-2 (mine-destructible)
// walls; the human is outside — flow distance is INF until a wall is blown.
// The pocket interior is 5x3 cells (rows 6-8, cols 5-9) so the bot has room
// to clear its own 90px blast: the breach safety gate requires a reachable
// cell ≥105px from the blast centre.
export const breachArena = withBorder([
  // ring rows 5 and 9, cols 4..10
  [5, 4, 2],
  [5, 5, 2],
  [5, 6, 2],
  [5, 7, 2],
  [5, 8, 2],
  [5, 9, 2],
  [5, 10, 2],
  [9, 4, 2],
  [9, 5, 2],
  [9, 6, 2],
  [9, 7, 2],
  [9, 8, 2],
  [9, 9, 2],
  [9, 10, 2],
  // ring cols 4 and 10, rows 6..8
  [6, 4, 2],
  [7, 4, 2],
  [8, 4, 2],
  [6, 10, 2],
  [7, 10, 2],
  [8, 10, 2],
  [6, 5, 13], // bot3 in the pocket's NW corner (wall within blast range)
  [7, 16, 3], // human outside
]);

// Sealed pocket made of INDESTRUCTIBLE walls — flow stays INF and no breach
// is possible (negative control for the mine policy).
export const sealedArena = withBorder([
  [6, 5, 1],
  [6, 6, 1],
  [6, 7, 1],
  [7, 5, 1],
  [7, 7, 1],
  [8, 5, 1],
  [8, 6, 1],
  [8, 7, 1],
  [7, 6, 13],
  [7, 16, 3],
]);
