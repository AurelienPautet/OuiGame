import { Player } from "../../Player.js";
import { AIGrid } from "../../ai/grid.js";
import { ThreatSummary } from "../../ai/perception.js";
import {
  resetIntent,
  solveSteering,
  type Intent,
  type SteerState,
} from "../../ai/steering.js";
import { DIR_STOP } from "../../ai/constants.js";
import { makeGrid } from "../fixtures/levels.js";
import type { Room } from "../../Room.js";

const emptyRoom = { players: {} } as unknown as Room;

const mk = (cx = 575, cy = 400) => {
  const bot = new Player({ x: cx - 22.5, y: cy - 22.5 }, "bot0", "B", "o", "o");
  const grid = new AIGrid();
  grid.rebuild(makeGrid());
  const threat = new ThreatSummary();
  const intent: Intent = {
    seekX: 0,
    seekY: 0,
    seekW: 0,
    strafeX: 0,
    strafeY: 0,
    strafeW: 0,
    allowStop: true,
  };
  const steer: SteerState = { curDirIdx: DIR_STOP, lastDirChange: -1e9 };
  return { bot, grid, threat, intent, steer };
};

describe("solveSteering", () => {
  it("moves along the seek intent", () => {
    const { bot, grid, threat, intent, steer } = mk();
    intent.seekX = 1;
    intent.seekY = 0;
    intent.seekW = 1;
    intent.allowStop = false;
    solveSteering(bot, emptyRoom, grid, threat, intent, steer, 100, false);
    expect(bot.direction.x).toBe(1);
    expect(bot.direction.y).toBe(0);
  });

  it("stops when allowed and nothing wants to move", () => {
    const { bot, grid, threat, intent, steer } = mk();
    resetIntent(intent);
    solveSteering(bot, emptyRoom, grid, threat, intent, steer, 100, false);
    expect(bot.direction.x).toBe(0);
    expect(bot.direction.y).toBe(0);
    expect(steer.curDirIdx).toBe(DIR_STOP);
  });

  it("refuses to walk into a wall even when seek points at it", () => {
    const { bot, threat, intent, steer } = mk(120, 400);
    const grid = new AIGrid();
    // Wall column immediately west of the bot (col 1, x 50..100).
    grid.rebuild(
      makeGrid([
        [6, 1, 1],
        [7, 1, 1],
        [8, 1, 1],
        [9, 1, 1],
      ] as never)
    );
    intent.seekX = -1;
    intent.seekY = 0;
    intent.seekW = 1;
    intent.allowStop = false;
    solveSteering(bot, emptyRoom, grid, threat, intent, steer, 100, false);
    // West is blocked: anything but straight west is acceptable.
    expect(bot.direction.x === -1 && bot.direction.y === 0).toBe(false);
  });

  it("holds the committed direction against marginally better options", () => {
    const { bot, grid, threat, intent, steer } = mk();
    intent.seekX = 1;
    intent.seekY = 0;
    intent.seekW = 1;
    intent.allowStop = false;
    solveSteering(bot, emptyRoom, grid, threat, intent, steer, 100, false);
    expect(steer.curDirIdx).toBe(0); // east

    // Nudge the intent slightly north-east: NE now scores marginally better,
    // but not by the 1.15x switch ratio — the bot must keep going east.
    intent.seekX = 0.92;
    intent.seekY = -0.39;
    solveSteering(bot, emptyRoom, grid, threat, intent, steer, 101, false);
    expect(steer.curDirIdx).toBe(0);

    // A forced solve (dodge trigger) may switch immediately.
    intent.seekX = 0;
    intent.seekY = -1;
    solveSteering(bot, emptyRoom, grid, threat, intent, steer, 102, true);
    expect(steer.curDirIdx).toBe(2); // north
  });

  it("steers around per-direction danger", () => {
    const { bot, grid, threat, intent, steer } = mk();
    intent.seekX = 1;
    intent.seekY = 0;
    intent.seekW = 1;
    intent.allowStop = false;
    threat.dirDanger[0] = 2; // east is death
    solveSteering(bot, emptyRoom, grid, threat, intent, steer, 100, true);
    expect(steer.curDirIdx).not.toBe(0);
  });
});
