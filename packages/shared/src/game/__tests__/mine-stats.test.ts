import { Mine } from "../Mine.js";
import { Stats } from "../Stats.js";
import { makeFakeRoom } from "./fixtures/levels.js";

// Characterization tests for the two simplest game-state holders. Mine and
// Stats carry no behaviour beyond construction/accumulation, but tickLoop and
// Room depend on their exact field set (e.g. round_stats.reset() must zero
// every field the stats repo persists), so these freeze that contract.

const makeEmitter = () => ({
  minecount: 0,
  round_stats: new Stats(),
});

describe("Mine", () => {
  it("initialises position/radius/timealive and registers with emitter + room", () => {
    const emitter = makeEmitter();
    const room = makeFakeRoom();
    const mine = new Mine({ x: 10, y: 20 }, emitter, room);

    expect(mine.position).toEqual({ x: 10, y: 20 });
    expect(mine.radius).toBe(15);
    expect(mine.timealive).toBe(0);
    expect(mine.color).toBe("yellow");

    expect(emitter.minecount).toBe(1);
    expect(emitter.round_stats.stats.plants).toBe(1);
    expect(room.sounds.plant).toBe(true);
    expect(room.mines).toEqual([mine]);
  });

  it("counts timealive in fixed simulation ticks (one per update)", () => {
    const mine = new Mine({ x: 0, y: 0 }, makeEmitter(), makeFakeRoom());
    mine.update();
    expect(mine.timealive).toBe(1);
    mine.update();
    expect(mine.timealive).toBe(2);
  });
});

describe("Stats", () => {
  const ZERO = {
    wins: 0,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    plants: 0,
    blocks_destroyed: 0,
  };

  it("constructs with all seven counters zeroed", () => {
    expect(new Stats().stats).toEqual(ZERO);
  });

  it("reset() restores every counter to zero", () => {
    const s = new Stats();
    s.stats.kills = 7;
    s.stats.blocks_destroyed = 3;
    s.reset();
    expect(s.stats).toEqual(ZERO);
  });
});
