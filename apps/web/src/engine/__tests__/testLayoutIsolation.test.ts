import { describe, expect, it } from "vitest";
import { GameEngine } from "../GameEngine";

// An editor test run loads the in-memory grid into a Room, and the Room OWNS
// that grid: mine blasts rewrite cells (destructible blocks 2 become rubble 10).
// startSolo must therefore hand the room a copy, or the test run mutates the
// editor's layout (and its retry source) and the creator publishes a level they
// never actually cleared.
describe("GameEngine.startSolo — editor test layout isolation", () => {
  it("loads a copy of the in-memory layout, never the caller's array", async () => {
    // Exercise startSolo's test-run branch without building a real engine (no
    // canvas/WebGL/socket): stub the room loader and the render loops.
    const engine = Object.create(GameEngine.prototype) as GameEngine;
    const loaded: number[][] = [];
    engine._loadSoloRoom = async (_levelId, grid) => {
      loaded.push(grid);
      // Simulate the room's own mutation of the grid it owns.
      grid[1] = 10;
    };
    engine._startLoops = () => {};

    const layout = [1, 2, 3];
    await engine.startSolo(
      -1,
      "pilot",
      { body: "orange", turret: "orange", paint: "default" },
      [],
      layout
    );

    expect(loaded).toHaveLength(1);
    // A distinct array reached the room...
    expect(loaded[0]).not.toBe(layout);
    // ...so the caller's layout is untouched by the run.
    expect(layout).toEqual([1, 2, 3]);
  });
});
