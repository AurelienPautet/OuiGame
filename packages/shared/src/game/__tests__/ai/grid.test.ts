import { Room } from "../../Room.js";
import { Player } from "../../Player.js";
import { Bullet } from "../../Bullet.js";
import { loadlevel } from "../../level_loader.js";
import { SIM_STEP_S } from "../../loop.js";
import {
  AIGrid,
  BouncePath,
  castBounceRay,
  castRay,
  makeRayHit,
  segmentClear,
  segCircleHit,
} from "../../ai/grid.js";
import { cellIdx } from "../../ai/constants.js";
import { makeGrid } from "../fixtures/levels.js";
import { bankWallArena } from "../fixtures/ai-levels.js";

// The grid raycaster is the v2 AI's model of bullet physics. The golden test
// here is the keystone of the whole system: a REAL Bullet stepped through the
// REAL Room must follow the castBounceRay polyline. If these ever diverge,
// every planned shot is a lie.

const mkRoom = () => new Room("arena", 1, [10], "creator", null);

describe("AIGrid.rebuild semantics", () => {
  it("separates shot-blocking walls from move-blocking cells", () => {
    const grid = new AIGrid();
    const level = makeGrid([
      [5, 5, 1], // solid wall
      [5, 6, 2], // destructible wall
      [5, 7, 4], // hole
      [5, 8, 10], // breached (cleared) wall
      [5, 9, 3], // spawn marker
    ] as never);
    grid.rebuild(level);

    expect(grid.walls[cellIdx(5, 5)]).toBe(1);
    expect(grid.walls[cellIdx(6, 5)]).toBe(1);
    expect(grid.wallType[cellIdx(6, 5)]).toBe(2);
    // Holes block movement but NOT shots.
    expect(grid.walls[cellIdx(7, 5)]).toBe(0);
    expect(grid.move[cellIdx(7, 5)]).toBe(1);
    // Breached cells and markers are fully clear.
    expect(grid.walls[cellIdx(8, 5)]).toBe(0);
    expect(grid.move[cellIdx(8, 5)]).toBe(0);
    expect(grid.walls[cellIdx(9, 5)]).toBe(0);
    // Border cells tanks can never reach are move-blocked even when empty.
    expect(grid.move[cellIdx(0, 3)]).toBe(1);
    expect(grid.move[cellIdx(22, 3)]).toBe(1);
    expect(grid.move[cellIdx(4, 0)]).toBe(1);
  });

  it("bumps version on every rebuild", () => {
    const grid = new AIGrid();
    const v0 = grid.version;
    grid.rebuild(makeGrid());
    grid.rebuild(makeGrid());
    expect(grid.version).toBe(v0 + 2);
  });
});

describe("castRay", () => {
  it("hits the r-offset face of a wall, not the cell boundary", () => {
    const grid = new AIGrid();
    grid.rebuild(makeGrid([[5, 10, 1]] as never)); // wall x∈[500,550], y∈[250,300]
    const hit = makeRayHit();
    // Straight +x ray at the wall's vertical midline.
    const found = castRay(grid, 300, 275, 1, 0, 1000, 7.5, hit);
    expect(found).toBe(true);
    expect(hit.axis).toBe(0);
    expect(hit.x).toBeCloseTo(500 - 7.5, 9);
    expect(hit.y).toBeCloseTo(275, 9);
    expect(hit.grazed).toBe(false);
  });

  it("flags a corner graze instead of inventing a reflection", () => {
    const grid = new AIGrid();
    grid.rebuild(makeGrid([[5, 10, 1]] as never)); // y∈[250,300]
    const hit = makeRayHit();
    // Passes 3px above the wall's top face: the real swept bullet would clip
    // the inflated corner, the offset-plane walk does not — it must flag the
    // graze (so planners reject the path) without inventing a reflection.
    // maxDist 400 keeps the ray short of the map edge (out-of-grid is solid).
    const found = castRay(grid, 300, 247, 1, 0, 400, 7.5, hit);
    expect(found).toBe(false);
    expect(hit.grazed).toBe(true);
    // Same path well clear of the corner band: clean.
    const found2 = castRay(grid, 300, 225, 1, 0, 400, 7.5, hit);
    expect(found2).toBe(false);
    expect(hit.grazed).toBe(false);
  });

  it("flies over holes", () => {
    const grid = new AIGrid();
    grid.rebuild(makeGrid([[5, 10, 4]] as never));
    expect(segmentClear(grid, 300, 275, 800, 275, 7.5)).toBe(true);
  });

  it("treats out-of-grid as solid (rays stop at the map edge)", () => {
    const grid = new AIGrid();
    grid.rebuild(makeGrid()); // completely empty level
    const hit = makeRayHit();
    expect(castRay(grid, 575, 400, 1, 0, 5000, 7.5, hit)).toBe(true);
    expect(hit.x).toBeLessThanOrEqual(23 * 50);
  });
});

describe("castBounceRay unfold transforms", () => {
  it("maps every folded vertex onto the straight unfolded ray", () => {
    const grid = new AIGrid();
    grid.rebuild(bankWallArena);
    const path = new BouncePath();
    const ox = 300;
    const oy = 400;
    const ang = 0.43;
    castBounceRay(
      grid,
      ox,
      oy,
      Math.cos(ang),
      Math.sin(ang),
      2,
      2500,
      7.5,
      path
    );
    expect(path.bounces).toBeGreaterThanOrEqual(1);

    // Vertex k+1 belongs to segment k: its unfolded image must sit exactly
    // segStart[k+1] along the original direction from the origin.
    for (let v = 1; v < path.n; v++) {
      const seg = v - 1;
      const ux = path.sx[seg]! * path.xs[v]! + path.tx[seg]!;
      const uy = path.sy[seg]! * path.ys[v]! + path.ty[seg]!;
      const s = path.segStart[v]!;
      expect(ux).toBeCloseTo(ox + s * Math.cos(ang), 6);
      expect(uy).toBeCloseTo(oy + s * Math.sin(ang), 6);
    }
  });
});

describe("segCircleHit", () => {
  it("returns the earliest entry distance and respects segment bounds", () => {
    expect(segCircleHit(0, 0, 1, 0, 100, 50, 0, 10)).toBeCloseTo(40, 9);
    expect(segCircleHit(0, 0, 1, 0, 30, 50, 0, 10)).toBe(-1); // beyond segment
    expect(segCircleHit(0, 0, 1, 0, 100, 50, 30, 10)).toBe(-1); // too far off-line
    expect(segCircleHit(0, 0, 1, 0, 100, -20, 0, 10)).toBe(-1); // behind
    expect(segCircleHit(0, 0, 1, 0, 100, 3, 0, 10)).toBe(0); // starts inside
  });
});

describe("GOLDEN: real Bullet vs castBounceRay", () => {
  it("the DDA path matches the engine's swept bullet within 1.5px", async () => {
    const room = mkRoom();
    await loadlevel(bankWallArena, room);
    const emitter = new Player({ x: 0, y: 0 }, "e", "E", "o", "o");

    // World direction ~25°: a long diagonal flight with multiple reflections
    // off the interior wall and the border ring. Bullet velocity is
    // (-cos a, -sin a)·speed, so fire with a = w + PI.
    const w = (25 * Math.PI) / 180;
    const start = { x: 300, y: 300 };
    const bullet = new Bullet(
      { x: start.x, y: start.y },
      w + Math.PI,
      300,
      { w: 15, h: 15 },
      3,
      1,
      emitter,
      room
    );

    const samples: { x: number; y: number; arc: number }[] = [];
    for (let k = 1; k <= 240 && room.bullets.length > 0; k++) {
      room.update(SIM_STEP_S);
      if (room.bullets[0] === bullet) {
        samples.push({
          x: bullet.position.x + bullet.size.w / 2,
          y: bullet.position.y + bullet.size.h / 2,
          arc: 300 * SIM_STEP_S * k,
        });
      }
    }
    // The flight must be long enough to include at least 2 reflections.
    expect(samples.length).toBeGreaterThan(100);

    const path = new BouncePath();
    castBounceRay(
      getGrid(room),
      start.x,
      start.y,
      Math.cos(w),
      Math.sin(w),
      3,
      300 * SIM_STEP_S * 260,
      7.5,
      path
    );
    expect(path.bounces).toBeGreaterThanOrEqual(2);

    for (const s of samples) {
      const p = pointAtArc(path, s.arc);
      const err = Math.hypot(p.x - s.x, p.y - s.y);
      expect(err).toBeLessThanOrEqual(1.5);
    }
  });
});

function getGrid(room: Room): AIGrid {
  const grid = new AIGrid();
  grid.rebuild(room.blocklist);
  return grid;
}

function pointAtArc(path: BouncePath, arc: number): { x: number; y: number } {
  let seg = 0;
  while (seg < path.n - 2 && path.segStart[seg + 1]! < arc) seg++;
  const segLen = path.segStart[seg + 1]! - path.segStart[seg]!;
  const t = segLen > 1e-9 ? (arc - path.segStart[seg]!) / segLen : 0;
  return {
    x: path.xs[seg]! + (path.xs[seg + 1]! - path.xs[seg]!) * t,
    y: path.ys[seg]! + (path.ys[seg + 1]! - path.ys[seg]!) * t,
  };
}
