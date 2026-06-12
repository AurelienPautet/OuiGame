import { Room } from "../../Room.js";
import { loadlevel } from "../../level_loader.js";
import { SIM_STEP_S } from "../../loop.js";
import { allKindsArena } from "../fixtures/ai-levels.js";

// Coarse perf smoke. The v2 design budget is ~50µs of AI per 60Hz tick for a
// 4-bot room (~3ms of AI work for 600 ticks); the assertion allows 2000ms so
// only an accidental O(n²)-per-think catastrophe can trip it — CI variance
// cannot. Fine-grained profiling belongs to the in-browser protocol.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("v2 AI perf smoke", () => {
  it("simulates 600 ticks of a 4-bot room in well under 2s", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    room.bot_system = "v2";
    room.bot_seed = 555;
    await loadlevel(allKindsArena, room);
    room.spawn_new_player("Human", "orange", "blue", "h1");
    room.spawn_all_bots();

    // Warm-up (JIT, lazy room-state init).
    for (let t = 0; t < 120; t++) room.update(SIM_STEP_S);

    const start = performance.now();
    for (let t = 0; t < 600; t++) room.update(SIM_STEP_S);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });
});
