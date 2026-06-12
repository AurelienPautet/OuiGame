import { AIGrid } from "../../ai/grid.js";
import { FlowField, FLOW_INF } from "../../ai/flow.js";
import { cellIdx } from "../../ai/constants.js";
import { makeGrid } from "../fixtures/levels.js";
import { mazeArena, sealedArena } from "../fixtures/ai-levels.js";

const gridOf = (level: number[]) => {
  const g = new AIGrid();
  g.rebuild(level);
  return g;
};

describe("FlowField BFS", () => {
  it("computes 4-neighbour tile distances around walls", () => {
    const g = gridOf(mazeArena);
    const f = new FlowField();
    // Source = the human at (row 3, col 18).
    f.compute(g, 18, 3);

    expect(f.distAt(18, 3)).toBe(0);
    expect(f.distAt(17, 3)).toBe(1);
    // The bot side (col 3, row 3) is reachable only around the gap at
    // rows 12-13 — far longer than the straight-line distance of 15.
    const d = f.distAt(3, 3);
    expect(d).toBeLessThan(FLOW_INF);
    expect(d).toBeGreaterThan(25);
    // Wall cells are never assigned a distance.
    expect(f.distAt(11, 5)).toBe(FLOW_INF);
  });

  it("marks sealed pockets unreachable", () => {
    const g = gridOf(sealedArena);
    const f = new FlowField();
    f.compute(g, 16, 7); // human outside the pocket
    expect(f.distAt(6, 7)).toBe(FLOW_INF); // pocket centre (bot cell)
    expect(f.distAt(10, 7)).toBeLessThan(FLOW_INF); // open field
  });

  it("downhill points toward the source, uphill away", () => {
    const g = gridOf(makeGrid()); // empty map (border handled by move grid)
    const f = new FlowField();
    f.compute(g, 15, 8);
    const dir = { x: 0, y: 0 };

    expect(f.downhillDir(5, 8, dir)).toBe(true);
    expect(dir.x).toBeGreaterThan(0.9); // source is due east
    expect(Math.abs(dir.y)).toBeLessThan(0.5);

    expect(f.uphillDir(5, 8, dir)).toBe(true);
    expect(dir.x).toBeLessThan(-0.9); // away is due west

    // At the source there is no downhill.
    expect(f.downhillDir(15, 8, dir)).toBe(false);
  });

  it("falls back to a free neighbour when the source cell is blocked", () => {
    const level = makeGrid([[8, 10, 4]] as never); // hole at the source
    const g = gridOf(level);
    const f = new FlowField();
    f.compute(g, 10, 8);
    // Field still exists, anchored next to the hole.
    expect(f.distAt(11, 8)).toBeLessThanOrEqual(1);
    expect(f.distAt(10, 8)).toBe(FLOW_INF); // the hole itself stays blocked
  });
});
