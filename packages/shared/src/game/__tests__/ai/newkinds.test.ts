import { Room } from "../../Room.js";
import { Bot } from "../../Bot.js";
import { loadlevel } from "../../level_loader.js";
import { SIM_STEP_S } from "../../loop.js";
import { AIBot } from "../../ai/index.js";
import { makeGrid, GRID_COLS, GRID_ROWS } from "../fixtures/levels.js";

// The two v2-only kinds: bot5 yellow Miner (level cell 15) and bot6 purple
// Hunter (cell 16). Legacy rooms skip their spawn slots but keep the global
// bot_index numbering, so campaign skipIds stay stable across systems.

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

describe("level loader cells 15/16", () => {
  it("fills bot5_spawns and bot6_spawns without disturbing 11-14", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    await loadlevel(
      makeGrid([
        [3, 3, 11],
        [3, 6, 12],
        [3, 9, 13],
        [3, 12, 14],
        [5, 3, 15],
        [5, 6, 15],
        [5, 9, 16],
      ] as never),
      room
    );
    expect(room.bot1_spawns).toHaveLength(1);
    expect(room.bot2_spawns).toHaveLength(1);
    expect(room.bot3_spawns).toHaveLength(1);
    expect(room.bot4_spawns).toHaveLength(1);
    expect(room.bot5_spawns).toEqual([
      { x: 150, y: 250 },
      { x: 300, y: 250 },
    ]);
    expect(room.bot6_spawns).toEqual([{ x: 450, y: 250 }]);
  });
});

describe("spawning the new kinds", () => {
  const mkRoom = () => {
    const room = new Room("arena", 1, [10], "creator", null);
    room.bot1_spawns = [{ x: 50, y: 50 }];
    room.bot5_spawns = [{ x: 100, y: 50 }];
    room.bot6_spawns = [{ x: 150, y: 50 }];
    return room;
  };

  it("v2 spawns AIBots with the new kinds, colors and chassis", () => {
    const room = mkRoom();
    room.bot_system = "v2";
    room.spawn_all_bots();

    expect(Object.keys(room.players)).toEqual(["bot0", "bot1", "bot2"]);
    const miner = room.players.bot1 as AIBot;
    const hunter = room.players.bot2 as AIBot;
    expect(miner.kind).toBe("bot5");
    expect(miner.name).toBe("Bot5_ 0");
    expect(miner.turretc).toBe("yellow");
    expect(miner.max_bulletcount).toBe(0); // no gun
    expect(miner.max_minecount).toBe(4);
    expect(hunter.kind).toBe("bot6");
    expect(hunter.turretc).toBe("purple");
    expect(hunter.max_bulletcount).toBe(5);
    expect(room.nbliving).toBe(3);
  });

  it("legacy skips the new kinds but keeps bot_index numbering stable", () => {
    const room = mkRoom();
    // default bot_system === "legacy"
    room.spawn_all_bots();

    // Only the bot1 sentry spawns; the bot5/bot6 slots (bot1, bot2 ids) stay
    // empty so ids match the v2 layout for campaign skipIds.
    expect(Object.keys(room.players)).toEqual(["bot0"]);
    expect(room.players.bot0).toBeInstanceOf(Bot);
    expect(room.nbliving).toBe(1);

    // Same arena under v2: the surviving sentry keeps id bot0, new kinds get
    // bot1/bot2 — numbering parity verified above.
  });

  it("skipIds keep working across the new slots", () => {
    const room = mkRoom();
    room.bot_system = "v2";
    room.spawn_all_bots(new Set(["bot1"])); // the miner was defeated
    expect(Object.keys(room.players)).toEqual(["bot0", "bot2"]);
    expect((room.players.bot2 as AIBot).kind).toBe("bot6");
  });
});

describe("new-kind behavior sims", () => {
  async function runArena(
    level: number[],
    seed: number,
    ticks: number,
    drive?: (room: Room, t: number) => void
  ): Promise<Room> {
    const room = new Room("arena", 1, [10], "creator", null);
    room.bot_system = "v2";
    room.bot_seed = seed;
    await loadlevel(level, room);
    room.spawn_new_player("Human", "orange", "blue", "h1");
    room.spawn_all_bots();
    for (let t = 0; t < ticks; t++) {
      drive?.(room, t);
      room.update(SIM_STEP_S);
    }
    return room;
  }

  it("the miner plants mines, never shoots, and survives its own field", async () => {
    // Human chases the miner to provoke flee-drops.
    const arena = withBorder([
      [8, 4, 15],
      [8, 18, 3],
    ]);
    const room = await runArena(arena, 77, 1800, (r) => {
      const bot = r.players.bot0;
      const human = r.players.h1;
      if (!bot?.alive || !human?.alive) return;
      human.direction.x = Math.sign(
        bot.position.x + 22.5 - (human.position.x + 22.5)
      );
      human.direction.y = Math.sign(
        bot.position.y + 22.5 - (human.position.y + 22.5)
      );
    });
    const miner = room.players.bot0 as AIBot;
    expect(miner.round_stats.stats.plants).toBeGreaterThanOrEqual(2);
    expect(miner.round_stats.stats.shots).toBe(0);
    expect(miner.alive).toBe(true);
  });

  it("the hunter closes to knife range and pressures with its 5-shot magazine", async () => {
    const arena = withBorder([
      [8, 4, 16],
      [8, 18, 3],
    ]);
    const room = await runArena(arena, 88, 1200);
    const hunter = room.players.bot0 as AIBot;
    const human = room.players.h1!;
    // Against an idle target the hunter must have closed in and fired plenty
    // (or already won the round).
    expect(
      hunter.round_stats.stats.shots + hunter.round_stats.stats.kills * 5
    ).toBeGreaterThanOrEqual(3);
    if (human.alive) {
      const d = Math.hypot(
        human.position.x - hunter.position.x,
        human.position.y - hunter.position.y
      );
      expect(d).toBeLessThan(450);
    }
  });
});
