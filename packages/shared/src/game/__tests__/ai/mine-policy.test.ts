import { Room } from "../../Room.js";
import { loadlevel } from "../../level_loader.js";
import { SIM_STEP_S } from "../../loop.js";
import { AIBot } from "../../ai/index.js";
import { breachArena, sealedArena, openArena } from "../fixtures/ai-levels.js";

// Mine policy, exercised through full seeded headless sims (the policy reads
// flow fields, threat state and grid neighbourhoods — unit-stubbing all of it
// would test the stub). Math.random is pinned only for spawn-slot choice;
// brain decisions draw from the seeded per-bot Rng.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function runArena(level: number[], ticks: number): Promise<Room> {
  const room = new Room("arena", 1, [10], "creator", null);
  room.bot_system = "v2";
  room.bot_seed = 1234;
  await loadlevel(level, room);
  room.spawn_new_player("Human", "orange", "blue", "h1");
  room.spawn_all_bots();
  for (let t = 0; t < ticks; t++) {
    room.update(SIM_STEP_S);
    if (Object.values(room.players).every((p) => !p.alive)) break;
  }
  return room;
}

describe("mine policy", () => {
  it("breaches a type-2 pocket it is sealed inside", async () => {
    const room = await runArena(breachArena, 700);
    const bot = room.players.bot0 as AIBot;
    expect(bot).toBeInstanceOf(AIBot);
    // The bot must have planted (mine count went up at some point): either a
    // live mine exists, the wall was already breached (blocks list shrank),
    // or the plant statistic recorded it.
    const planted = bot.round_stats.stats.plants;
    expect(planted).toBeGreaterThanOrEqual(1);
    // And the breach must actually open the pocket: at least one of the 20
    // type-2 ring blocks destroyed by the 700-tick mark (fuse is 300 ticks).
    const type2Left = room.blocks.filter((b) => b.type === 2).length;
    expect(type2Left).toBeLessThan(20);
  });

  it("never plants when sealed by indestructible walls (no breach, no path)", async () => {
    const room = await runArena(sealedArena, 700);
    const bot = room.players.bot0 as AIBot;
    expect(bot).toBeInstanceOf(AIBot);
    expect(bot.round_stats.stats.plants).toBe(0);
  });

  it("survives its own mines (zero self-kills across the breach sim)", async () => {
    const room = await runArena(breachArena, 1200);
    const bot = room.players.bot0 as AIBot | undefined;
    // The bot may legitimately die to the HUMAN later only if the human shot
    // it — but there is no human input in this sim, so any death would be a
    // self-mine failure. It must be alive.
    expect(bot?.alive).toBe(true);
  });

  it("does not mine in the open with a distant target", async () => {
    const room = await runArena(openArena, 400);
    const bot = room.players.bot0 as AIBot;
    // bot2 in the open: no corridor, target far, no pursuit — no mines.
    expect(bot.round_stats.stats.plants).toBe(0);
  });
});
