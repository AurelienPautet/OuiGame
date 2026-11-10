import { Room } from "../../Room.js";
import { Player } from "../../Player.js";
import { loadlevel } from "../../level_loader.js";
import { SIM_STEP_S } from "../../loop.js";
import { AIBot } from "../../ai/index.js";
import { canReleaseShot } from "../../ai/brain.js";
import { angleDiff, TILE } from "../../ai/constants.js";
import { GRID_COLS, GRID_ROWS, makeGrid } from "../fixtures/levels.js";

// A full-height wall at column 11 splits the arena. A stationary sniper sits
// on the left with the player; moving the player to the right breaks sight.
const walledLevel = makeGrid([
  ...Array.from({ length: GRID_COLS }, (_, c) => [0, c, 1] as const),
  ...Array.from(
    { length: GRID_COLS },
    (_, c) => [GRID_ROWS - 1, c, 1] as const
  ),
  ...Array.from({ length: GRID_ROWS }, (_, r) => [r, 0, 1] as const),
  ...Array.from(
    { length: GRID_ROWS },
    (_, r) => [r, GRID_COLS - 1, 1] as const
  ),
  ...Array.from({ length: GRID_ROWS - 2 }, (_, i) => [i + 1, 11, 1] as const),
  [3, 8, 14], // bot4 — stationary sniper
  [8, 8, 3], // human, same side of the wall
]);

const centerOf = (p: Player) => ({
  x: p.position.x + p.size.w / 2,
  y: p.position.y + p.size.h / 2,
});

async function mkRoom(seed: number) {
  const room = new Room("arena", 1, [10], "creator", null);
  room.bot_system = "v2";
  room.bot_seed = seed;
  await loadlevel(walledLevel, room);
  room.spawn_new_player("Human", "orange", "blue", "h1");
  room.spawn_all_bots();
  return room;
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("shot release gate", () => {
  it("allows direct fire only with sight", () => {
    expect(canReleaseShot(1, true, 1000, 1000)).toBe(true);
    expect(canReleaseShot(1, false, 1000, 1000)).toBe(false);
  });

  it("allows bank fire only while the last sighting is warm", () => {
    expect(canReleaseShot(2, false, 1180, 1000)).toBe(true);
    expect(canReleaseShot(2, false, 1181, 1000)).toBe(false);
  });

  it("never releases an empty solution", () => {
    expect(canReleaseShot(0, true, 1000, 1000)).toBe(false);
  });
});

describe("fair perception", () => {
  it("holds the last seen point instead of tracking through a wall", async () => {
    const room = await mkRoom(7);
    const bot = room.players.bot0! as AIBot;
    const human = room.players.h1!;
    const brain = bot.brainForTest;

    // Let the sniper settle on the visible player. Pin its magazine so this
    // test measures perception, not a kill.
    for (let t = 0; t < 180; t++) {
      bot.bulletcount = bot.max_bulletcount;
      room.update(SIM_STEP_S);
    }
    const b0 = centerOf(bot);
    const seen = centerOf(human);
    const seenAngle = Math.atan2(seen.y - b0.y, seen.x - b0.x);
    expect(Math.abs(angleDiff(brain.turretWorld, seenAngle))).toBeLessThan(0.2);

    // Teleport the player to the far side of the wall. Sight is now broken;
    // the turret must not swing to the live position.
    human.position.x = 12 * TILE + 8;
    for (let t = 0; t < 30; t++) {
      bot.bulletcount = bot.max_bulletcount;
      room.update(SIM_STEP_S);
    }

    const b1 = centerOf(bot);
    const hidden = centerOf(human);
    const hiddenAngle = Math.atan2(hidden.y - b1.y, hidden.x - b1.x);
    expect(Math.abs(angleDiff(brain.turretWorld, hiddenAngle))).toBeGreaterThan(
      0.5
    );
    expect(Math.abs(angleDiff(brain.turretWorld, seenAngle))).toBeLessThan(0.3);
  });

  it("does not fire once the last-seen memory expires", async () => {
    const room = await mkRoom(7);
    const bot = room.players.bot0! as AIBot;
    const human = room.players.h1!;

    // See the player, then hide behind the wall. Keep the magazine pinned
    // while the memory is still warm so only post-expiry shots are counted.
    for (let t = 0; t < 180; t++) {
      bot.bulletcount = bot.max_bulletcount;
      room.update(SIM_STEP_S);
    }
    human.position.x = 12 * TILE + 8;
    for (let t = 0; t < 200; t++) {
      bot.bulletcount = bot.max_bulletcount;
      room.update(SIM_STEP_S);
    }
    expect(bot.round_stats.stats.shots).toBe(0);

    // Memory is now cold. The bot may sweep its turret, but it must not
    // release a bank or direct shot at the hidden player's live position.
    bot.bulletcount = 0;
    for (let t = 0; t < 300; t++) room.update(SIM_STEP_S);
    expect(bot.round_stats.stats.shots).toBe(0);
  });
});
