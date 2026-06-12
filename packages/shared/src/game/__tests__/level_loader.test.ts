import { loadlevel, generateBcollision } from "../level_loader.js";
import {
  interiorBlock,
  mixedArena,
  botArena,
  square2x2,
  makeGrid,
  GRID_COLS,
} from "./fixtures/levels.js";

// Characterization tests for level parsing + collision-box merging. The grid is
// 23 cols × 16 rows; cell codes: 1 solid, 2 destructible, 3 spawn, 4 hole,
// 11–16 bot spawns. (The historical c<=23 over-read quirk was deliberately
// FIXED — strict loop bounds — when cells 15/16 joined the format; the test
// below now pins the fix instead of the quirk.)

describe("loadlevel — grid parsing", () => {
  it("parses a single interior solid block", async () => {
    const room = {};
    await loadlevel(interiorBlock, room);
    expect(room.blocks).toHaveLength(1);
    expect(room.blocks[0].position).toEqual({ x: 250, y: 50 }); // col5,row1
    expect(room.blocks[0].type).toBe(1);
    expect(room.spawns).toEqual([]);
    expect(room.holes).toEqual([]);
  });

  it("classifies spawns, destructible blocks, and holes by cell code", async () => {
    const room = {};
    await loadlevel(mixedArena, room);
    expect(room.blocks).toHaveLength(1);
    expect(room.blocks[0].type).toBe(2); // destructible
    expect(room.blocks[0].position).toEqual({ x: 500, y: 250 });
    expect(room.spawns).toEqual([
      { x: 150, y: 100 },
      { x: 350, y: 100 },
    ]);
    expect(room.holes).toHaveLength(1);
    expect(room.holes[0].position).toEqual({ x: 200, y: 400 });
  });

  it("routes bot-spawn codes 11–14 into their per-kind pools", async () => {
    const room = {};
    await loadlevel(botArena, room);
    expect(room.bot1_spawns).toEqual([{ x: 150, y: 150 }]);
    expect(room.bot2_spawns).toEqual([{ x: 300, y: 150 }]);
    expect(room.bot3_spawns).toEqual([{ x: 450, y: 150 }]);
    expect(room.bot4_spawns).toEqual([{ x: 600, y: 150 }]);
    expect(room.spawns).toHaveLength(2);
  });

  it("reads column 0 exactly once (the c<=23 over-read quirk is fixed)", async () => {
    // Historically the parse loop ran c up to 23, so index l*23+23 ==
    // (l+1)*23+0 and any column-0 marker was read twice — once as a phantom
    // at x=1150 (off the playfield). Strict bounds parse each cell once.
    const room = {};
    await loadlevel(makeGrid([[1, 0, 3]]), room);
    expect(room.spawns).toEqual([
      { x: 0, y: 50 }, // the real cell (row1, col0) — and nothing else
    ]);
  });
});

describe("generateBcollision — merging adjacent blocks", () => {
  // Drive generateBcollision directly with a blocklist + empty Bcollision.
  const boxesFor = (grid) => {
    const room = { blocklist: grid, Bcollision: [] };
    generateBcollision(room);
    return room.Bcollision.map((b) => ({ ...b.position, ...b.size }));
  };

  it("emits one 50×50 box for an isolated block", () => {
    expect(boxesFor(makeGrid([[1, 5, 1]]))).toEqual([
      { x: 250, y: 50, w: 50, h: 50 },
    ]);
  });

  it("merges a horizontal run into one wide box", () => {
    const grid = makeGrid([
      [2, 1, 1],
      [2, 2, 1],
      [2, 3, 1],
    ]);
    expect(boxesFor(grid)).toEqual([{ x: 50, y: 100, w: 150, h: 50 }]);
  });

  it("merges a vertical run into one tall box", () => {
    const grid = makeGrid([
      [1, 5, 1],
      [2, 5, 1],
      [3, 5, 1],
    ]);
    expect(boxesFor(grid)).toEqual([{ x: 250, y: 50, w: 50, h: 150 }]);
  });

  it("merges a 2×2 square into a single 100×100 box (second-pass y/x merge)", () => {
    expect(boxesFor(square2x2)).toEqual([{ x: 50, y: 50, w: 100, h: 100 }]);
  });

  it("treats destructible (type 2) blocks the same as solid for collision", () => {
    const grid = makeGrid([
      [4, 4, 2],
      [4, 5, 2],
    ]);
    expect(boxesFor(grid)).toEqual([{ x: 200, y: 200, w: 100, h: 50 }]);
  });

  it("uses a 23-wide stride (no horizontal wrap across rows)", () => {
    // Last column of one row + first column of the next must NOT merge.
    const grid = makeGrid([
      [2, GRID_COLS - 1, 1], // (row2, col22)
      [3, 0, 1], // (row3, col0)
    ]);
    const boxes = boxesFor(grid);
    expect(boxes).toHaveLength(2);
  });
});
