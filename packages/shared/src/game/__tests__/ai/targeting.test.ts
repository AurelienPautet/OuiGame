import { Room } from "../../Room.js";
import { Player } from "../../Player.js";
import { loadlevel } from "../../level_loader.js";
import { AIGrid } from "../../ai/grid.js";
import {
  ShotSolution,
  desiredAngleFor,
  refreshSolution,
  solveIntercept,
} from "../../ai/targeting.js";
import { ARCHETYPES } from "../../ai/archetypes.js";
import { bankWallArena, openArena } from "../fixtures/ai-levels.js";

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
    const bot = new Player({ x: 0, y: 0 }, "bot0", "B", "o", "o");
    const target = new Player({ x: 0, y: 0 }, "h1", "H", "o", "o");
    place(bot, 0 + 22.5, 0 + 22.5);
    place(target, 400 + 22.5, 0 + 22.5);
    const sol = new ShotSolution();
    sol.kind = 1;
    const ai = { ...ARCHETYPES.bot4.ai }; // leadFactor 1
    const ang = desiredAngleFor(bot, target, 0, 180, ai, sol, 0);
    // Aim point leads DOWN (+y): angle strictly positive, below the x-axis.
    expect(ang).toBeGreaterThan(0.3);
    expect(ang).toBeLessThan(Math.PI / 2);
  });
});
