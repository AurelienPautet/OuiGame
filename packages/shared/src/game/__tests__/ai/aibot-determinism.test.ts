import { Room } from "../../Room.js";
import { loadlevel } from "../../level_loader.js";
import { SIM_STEP_S } from "../../loop.js";
import { allKindsArena } from "../fixtures/ai-levels.js";

// Determinism contract: with a pinned Room.bot_seed (and pinned spawn picks),
// two simulations of the same room are IDENTICAL — every decision the brains
// make draws from the seeded per-bot RNG, never Math.random.
//
// Deliberately NOT a cross-platform pinned-literal golden: positions feed
// through Math.cos/sin/atan2, whose last-ULP results differ between Node/V8
// versions, and 300 ticks of feedback chaos amplifies that beyond any
// rounding tolerance (the repo's bot-aim.test.ts documents the same issue).
// Same-process equality IS the user-facing guarantee (same seed ⇒ same game).

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function runDigest(seed: number, ticks: number): Promise<string> {
  const room = new Room("arena", 1, [10], "creator", null);
  room.bot_system = "v2";
  room.bot_seed = seed;
  await loadlevel(allKindsArena, room);
  room.spawn_new_player("Human", "orange", "blue", "h1");
  room.spawn_all_bots();
  const frames: unknown[] = [];
  for (let t = 0; t < ticks; t++) {
    room.update(SIM_STEP_S);
    if (t % 30 === 0) {
      frames.push(
        Object.entries(room.players).map(([id, p]) => [
          id,
          p.alive,
          p.position?.x,
          p.position?.y,
          p.angle,
          p.bulletcount,
          p.minecount,
        ])
      );
    }
  }
  frames.push([room.bullets.length, room.mines.length, room.nbliving]);
  return JSON.stringify(frames);
}

describe("seeded determinism", () => {
  it("identical digests for two runs with the same bot_seed", async () => {
    const a = await runDigest(0xc0ffee, 600);
    const b = await runDigest(0xc0ffee, 600);
    expect(b).toBe(a);
  });

  it("different bot_seeds genuinely diverge", async () => {
    const a = await runDigest(1, 600);
    const b = await runDigest(2, 600);
    expect(b).not.toBe(a);
  });
});
