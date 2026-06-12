import { Room } from "../../Room.js";
import { loadlevel } from "../../level_loader.js";
import { SIM_STEP_S } from "../../loop.js";
import { ARCHETYPES } from "../../ai/index.js";
import { makeGrid, GRID_COLS, GRID_ROWS } from "../fixtures/levels.js";

// The player-equal kind bot7: no level cell, spawned only via
// Room.spawn_lobby_bot, exactly a human's chassis, driven by the v2 brain.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Cell = [number, number, number];
const withBorder = (cells: Cell[]): number[] => {
  const ring: Cell[] = [];
  for (let c = 0; c < GRID_COLS; c++) {
    ring.push([0, c, 1], [GRID_ROWS - 1, c, 1]);
  }
  for (let r = 1; r < GRID_ROWS - 1; r++) {
    ring.push([r, 0, 1], [r, GRID_COLS - 1, 1]);
  }
  return makeGrid([...ring, ...cells] as never);
};

describe("bot7 archetype", () => {
  it("has no level spawn cell wired anywhere", async () => {
    // Every known bot cell code fills its kind's spawn list; none maps to
    // bot7, so a level can never author a lobby bot.
    const room = new Room("arena", 1, [10], "creator", null);
    await loadlevel(
      makeGrid([
        [3, 3, 11],
        [3, 6, 12],
        [3, 9, 13],
        [3, 12, 14],
        [5, 3, 15],
        [5, 6, 16],
      ] as never),
      room
    );
    room.bot_system = "v2";
    room.spawn_all_bots();
    for (const id in room.players) {
      expect((room.players[id] as { kind?: string }).kind).not.toBe("bot7");
    }
  });

  it("keeps the quality ceiling reachable for all 5 bullets", () => {
    const ai = ARCHETYPES.bot7.ai;
    const chassis = ARCHETYPES.bot7.chassis;
    // The fire gate is minQuality + qualityPerBullet * bulletcount; with the
    // last bullet in flight the bar must stay under the ~1.15 quality ceiling.
    expect(
      ai.minQuality + ai.qualityPerBullet * (chassis.max_bulletcount - 1)
    ).toBeLessThan(1.15);
    expect(ai.maxPlanBounces).toBeLessThanOrEqual(chassis.shoot_max_bounce - 1);
  });
});

describe("bot7 duel sim", () => {
  it("hunts an idle human: closes in and pressures with real shots", async () => {
    const arena = withBorder([
      [8, 4, 3],
      [8, 18, 3],
    ]);
    const room = new Room("arena", 1, [10], "creator", null);
    room.bot_seed = 99;
    await loadlevel(arena, room);
    // Math.random is pinned to 0, so the human takes spawns[0] (8,4) and the
    // lobby bot takes the remaining (8,18).
    room.spawn_new_player("Human", "orange", "blue", "h1");
    const bot = room.spawn_lobby_bot()!;
    expect(bot.kind).toBe("bot7");

    const spawnX = bot.position.x;
    const spawnY = bot.position.y;
    for (let t = 0; t < 1200; t++) {
      room.update(SIM_STEP_S);
      if (!room.players.h1?.alive) break;
    }

    // It moved off its spawn and fired (or already finished the job).
    expect(
      Math.hypot(bot.position.x - spawnX, bot.position.y - spawnY)
    ).toBeGreaterThan(50);
    expect(
      bot.round_stats.stats.shots + bot.round_stats.stats.kills * 5
    ).toBeGreaterThanOrEqual(2);

    const human = room.players.h1!;
    if (human.alive) {
      // Engagement band is 150–350: it must have closed most of the gap.
      const d = Math.hypot(
        human.position.x - bot.position.x,
        human.position.y - bot.position.y
      );
      expect(d).toBeLessThan(500);
    }
  });
});
