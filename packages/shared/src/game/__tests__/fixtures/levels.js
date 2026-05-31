// Shared test fixtures for the game-logic suites. This file lives under
// __tests__/ but is NOT a suite: the `shared` Vitest project only collects
// `src/game/__tests__/**/*.{test,spec}.js`, so `fixtures/levels.js` is ignored
// as a test and imported only as a helper.
//
// The level grid is row-major, 23 columns × 16 rows = 368 cells. Cell codes
// (mirrored from level_loader.js): 1 = solid block, 2 = destructible block,
// 3 = player spawn, 4 = hole, 11–14 = bot1–4 spawns.

export const GRID_COLS = 23;
export const GRID_ROWS = 16;
export const GRID_SIZE = GRID_COLS * GRID_ROWS; // 368

// Build a flat 368-cell grid of zeros, then stamp the given cells.
// `cells` is an array of [row, col, type] tuples.
export function makeGrid(cells = []) {
  const grid = new Array(GRID_SIZE).fill(0);
  for (const [row, col, type] of cells) {
    grid[row * GRID_COLS + col] = type;
  }
  return grid;
}

export const idx = (row, col) => row * GRID_COLS + col;

// A single interior solid block at (row 1, col 5). Interior placement avoids
// the column-0 double-read quirk in loadlevel (see level_loader.test.js), so
// this block is parsed exactly once.
export const interiorBlock = makeGrid([[1, 5, 1]]);

// Two player spawns + one destructible block + one hole, all interior.
export const mixedArena = makeGrid([
  [2, 3, 3], // player spawn
  [2, 7, 3], // player spawn
  [5, 10, 2], // destructible block
  [8, 4, 4], // hole
]);

// One spawn cell per bot kind (codes 11–14), all interior.
export const botArena = makeGrid([
  [3, 3, 11],
  [3, 6, 12],
  [3, 9, 13],
  [3, 12, 14],
  [10, 5, 3], // a human spawn too
  [10, 9, 3],
]);

// Minimal arena with two human spawns far apart — handy for Room lifecycle.
export const twoSpawnArena = makeGrid([
  [4, 4, 3],
  [4, 16, 3],
]);

// A 2×2 solid square at rows 1–2, cols 1–2 (interior). generateBcollision
// should merge this into a single 100×100 collision box.
export const square2x2 = makeGrid([
  [1, 1, 1],
  [1, 2, 1],
  [2, 1, 1],
  [2, 2, 1],
]);

// Records every emit routed through a fake socket.io `io`. Room.emit_to_room
// calls `io.to("room"+id).emit(event, data)`, so `to()` returns a recorder.
export function makeRecordingIo() {
  const emitted = [];
  const io = {
    to(target) {
      return {
        emit(event, data) {
          emitted.push({ target, event, data });
        },
      };
    },
    emit(event, data) {
      emitted.push({ target: null, event, data });
    },
  };
  return { io, emitted };
}

// A minimal duck-typed room sufficient for Bullet/Mine/Player unit tests that
// don't need the full Room class.
export function makeFakeRoom(overrides = {}) {
  return {
    sounds: {},
    bullets: [],
    mines: [],
    holes: [],
    players: {},
    Bcollision: [],
    blocks: [],
    emit_to_room() {},
    ...overrides,
  };
}
