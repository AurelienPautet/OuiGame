import { Room } from "../../Room.js";
import { Player } from "../../Player.js";
import { loadlevel } from "../../level_loader.js";
import { AIGrid, clampPredictPoint } from "../../ai/grid.js";
import {
  ShotSolution,
  desiredAngleFor,
  refreshSolution,
  solveIntercept,
} from "../../ai/targeting.js";
import { ARCHETYPES } from "../../ai/archetypes.js";
import { bankWallArena, openArena } from "../fixtures/ai-levels.js";
import { makeGrid } from "../fixtures/levels.js";

const ICPT = { t: 0, x: 0, y: 0 };

describe("solveIntercept", () => {
  it("aims straight at a stationary target", () => {
    expect(solveIntercept(0, 0, 300, 0, 0, 0, 300, ICPT)).toBe(true);
    expect(ICPT.t).toBeCloseTo(1, 9);
    expect(ICPT.x).toBeCloseTo(300, 9);
    expect(ICPT.y).toBeCloseTo(0, 9);
  });

  it("leads a crossing target by the exact flight time", () => {
    // Target at (400, 0) moving +y at 180; bullet 300 px/s from origin.
    expect(solveIntercept(0, 0, 400, 0, 0, 180, 300, ICPT)).toBe(true);
    // |q + v t| = s t  ⇒  400² + (180t)² = (300t)²  ⇒  t = 400/240.
    expect(ICPT.t).toBeCloseTo(400 / 240, 9);
    expect(ICPT.x).toBeCloseTo(400, 9);
    expect(ICPT.y).toBeCloseTo(180 * (400 / 240), 9);
    // The intercept point really is reached simultaneously by both.
    expect(Math.hypot(ICPT.x, ICPT.y)).toBeCloseTo(300 * ICPT.t, 9);
  });

  it("handles a fleeing target (still catchable: bullet is faster)", () => {
    expect(solveIntercept(0, 0, 300, 0, 180, 0, 300, ICPT)).toBe(true);
    expect(ICPT.t).toBeCloseTo(300 / 120, 9);
  });

  it("returns t=0 when on top of the target", () => {
    expect(solveIntercept(100, 100, 100, 100, 50, 0, 300, ICPT)).toBe(true);
    expect(ICPT.t).toBe(0);
  });
});

const mkRoom = () => new Room("arena", 1, [10], "creator", null);
const gridOf = (room: Room) => {
  const g = new AIGrid();
  g.rebuild(room.blocklist);
  return g;
};
const place = (p: Player, cx: number, cy: number) => {
  p.position = { x: cx - p.size.w / 2, y: cy - p.size.h / 2 };
};

describe("refreshSolution", () => {
  it("finds a clean direct solution with open line of sight", async () => {
    const room = mkRoom();
    await loadlevel(openArena, room);
    const bot = new Player({ x: 0, y: 0 }, "bot0", "B", "o", "o");
    const target = new Player({ x: 0, y: 0 }, "h1", "H", "o", "o");
    place(bot, 300, 425);
    place(target, 800, 425);
    room.players = { bot0: bot, h1: target };
    room.human_players = ["h1"];

    const sol = new ShotSolution();
    refreshSolution(
      gridOf(room),
      bot,
      room,
      target,
      0,
      0,
      ARCHETYPES.bot2.ai,
      sol,
      { phase: 0 }
    );
    expect(sol.kind).toBe(1);
    expect(sol.worldAngle).toBeCloseTo(0, 2); // due east
    // 500px at 300px/s ≈ 1.6s flight: quality ≈ (1 − 1.6/2.5)·1.15 ≈ 0.4.
    expect(sol.quality).toBeGreaterThan(0.3);
  });

  it("finds a 1-bounce bank when the direct line is walled off", async () => {
    const room = mkRoom();
    await loadlevel(bankWallArena, room);
    // Interior wall col 11 spans rows 4..11 (y 200..600). Both tanks sit at
    // y=425 on opposite sides: direct LOS blocked, bounce over the top gap
    // (rows 1..3) or off the top border exists.
    const bot = new Player({ x: 0, y: 0 }, "bot0", "B", "o", "o");
    const target = new Player({ x: 0, y: 0 }, "h1", "H", "o", "o");
    place(bot, 350, 425);
    place(target, 800, 425);
    room.players = { bot0: bot, h1: target };
    room.human_players = ["h1"];

    const sol = new ShotSolution();
    refreshSolution(
      gridOf(room),
      bot,
      room,
      target,
      0,
      0,
      ARCHETYPES.bot4.ai, // 2-bounce planner with fan
      sol,
      { phase: 0 }
    );
    expect(sol.kind).toBe(2);
    expect(sol.bounces).toBeGreaterThanOrEqual(1);
    expect(sol.quality).toBeGreaterThan(0);
  });

  it("refuses to shoot through a friendly bot", async () => {
    const room = mkRoom();
    await loadlevel(openArena, room);
    const bot = new Player({ x: 0, y: 0 }, "bot0", "B", "o", "o");
    const friendly = new Player({ x: 0, y: 0 }, "bot1", "F", "o", "o");
    const target = new Player({ x: 0, y: 0 }, "h1", "H", "o", "o");
    place(bot, 300, 425);
    place(friendly, 550, 425); // squarely on the firing line
    place(target, 800, 425);
    room.players = { bot0: bot, bot1: friendly, h1: target };
    room.human_players = ["h1"];

    const sol = new ShotSolution();
    refreshSolution(
      gridOf(room),
      bot,
      room,
      target,
      0,
      0,
      ARCHETYPES.bot3.ai, // direct-only planner: no bank alternative
      sol,
      { phase: 0 }
    );
    expect(sol.kind).toBe(0);
  });

  it("clears the solution when the target is unreachable", async () => {
    const room = mkRoom();
    await loadlevel(bankWallArena, room);
    const bot = new Player({ x: 0, y: 0 }, "bot0", "B", "o", "o");
    const target = new Player({ x: 0, y: 0 }, "h1", "H", "o", "o");
    place(bot, 350, 425);
    place(target, 800, 425);
    room.players = { bot0: bot, h1: target };
    room.human_players = ["h1"];

    const sol = new ShotSolution();
    refreshSolution(
      gridOf(room),
      bot,
      room,
      target,
      0,
      0,
      ARCHETYPES.bot3.ai, // 600 px/s but ZERO planned bounces
      sol,
      { phase: 0 }
    );
    // Direct is walled; bot3 may not bank: no solution.
    expect(sol.kind).toBe(0);
  });
});

describe("desiredAngleFor", () => {
  it("re-leads a direct solution from live target state", () => {
    const grid = new AIGrid();
    grid.rebuild(makeGrid());
    const bot = new Player({ x: 0, y: 0 }, "bot0", "B", "o", "o");
    const target = new Player({ x: 0, y: 0 }, "h1", "H", "o", "o");
    place(bot, 222.5, 422.5);
    place(target, 622.5, 422.5);
    const sol = new ShotSolution();
    sol.kind = 1;
    const ai = { ...ARCHETYPES.bot4.ai }; // leadFactor 1
    const ang = desiredAngleFor(grid, bot, target, 0, 180, ai, sol, 0);
    // Target runs DOWN (+y) in open field: the aim leads below the x-axis.
    expect(ang).toBeGreaterThan(0.3);
    expect(ang).toBeLessThan(Math.PI / 2);
  });
});

describe("wall-aware lead prediction", () => {
  it("clampPredictPoint stops at walls, slides along them, ignores open field", () => {
    const grid = new AIGrid();
    // Wall column at col 16 (x 800..850), rows 6..10 (y 300..550).
    grid.rebuild(
      makeGrid([
        [6, 16, 1],
        [7, 16, 1],
        [8, 16, 1],
        [9, 16, 1],
        [10, 16, 1],
      ] as never)
    );
    const out = { x: 0, y: 0 };

    // Open field: untouched.
    clampPredictPoint(grid, 300, 425, 500, 425, out);
    expect(out).toEqual({ x: 500, y: 425 });

    // Straight into the wall: clamped in front of the face (x < 800).
    clampPredictPoint(grid, 740, 425, 950, 425, out);
    expect(out.x).toBeLessThan(800);
    expect(out.x).toBeGreaterThan(740);
    expect(out.y).toBe(425);

    // Diagonal into the wall: the free axis keeps going (wall slide).
    clampPredictPoint(grid, 740, 425, 940, 625, out);
    expect(out.x).toBeLessThan(800);
    expect(out.y).toBeGreaterThan(500); // slid downward along the wall

    // Holes block tank movement too.
    const holes = new AIGrid();
    holes.rebuild(makeGrid([[8, 16, 4]] as never));
    clampPredictPoint(holes, 740, 425, 950, 425, out);
    expect(out.x).toBeLessThan(800);
  });

  it("keeps a firing solution on a target running into a wall (strike in front of it)", async () => {
    const room = mkRoom();
    await loadlevel(
      makeGrid([
        [6, 16, 1],
        [7, 16, 1],
        [8, 16, 1],
        [9, 16, 1],
        [10, 16, 1],
      ] as never),
      room
    );
    const bot = new Player({ x: 0, y: 0 }, "bot0", "B", "o", "o");
    const target = new Player({ x: 0, y: 0 }, "h1", "H", "o", "o");
    place(bot, 300, 425);
    place(target, 740, 425);
    room.players = { bot0: bot, h1: target };
    room.human_players = ["h1"];
    bot.shoot_speed = 600;

    const sol = new ShotSolution();
    // Full-lead archetype, target sprinting +x straight at the wall: the
    // unclamped prediction (x ≈ 930) is INSIDE the wall — pre-fix this either
    // produced no solution or aimed at an unreachable point.
    refreshSolution(
      gridOf(room),
      bot,
      room,
      target,
      180,
      0,
      ARCHETYPES.bot4.ai,
      sol,
      { phase: 0 }
    );
    expect(sol.kind).toBe(1);
    // Strike lands before the wall face, where the target will actually be.
    expect(sol.tFlight * 600).toBeLessThan(520);
  });
});
