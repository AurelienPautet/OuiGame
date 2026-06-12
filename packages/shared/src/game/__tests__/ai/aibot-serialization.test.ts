import { Player } from "../../Player.js";
import { AIBot } from "../../ai/index.js";

// Wire-safety guard. Rooms broadcast `tick` with raw player objects and
// socket.io serializes every enumerable own property, so the AIBot's entire
// brain must live behind #private fields. The contract pinned here: an AIBot
// serializes to exactly a Player plus the single `kind` tag — nothing else,
// ever. (The legacy Bot leaks ~20 AI fields onto the wire; v2 must not.)

const jsonKeys = (o: object): string[] =>
  Object.keys(JSON.parse(JSON.stringify(o)) as object).sort();

describe("AIBot wire shape", () => {
  it("serializes to Player's keys plus exactly { kind }", () => {
    const player = new Player({ x: 200, y: 200 }, "p1", "P", "orange", "blue");
    const aibot = new AIBot(
      { x: 200, y: 200 },
      "bot0",
      "Bot2_ 0",
      "green",
      "green",
      "bot2",
      1234
    );

    const expected = [...jsonKeys(player), "kind"].sort();
    expect(jsonKeys(aibot)).toEqual(expected);
  });

  it("exposes no brain/seed state as own properties", () => {
    const aibot = new AIBot(
      { x: 0, y: 0 },
      "bot0",
      "Bot1_ 0",
      "blue",
      "blue",
      "bot1",
      42
    );
    for (const key of Object.keys(aibot)) {
      expect(key).not.toMatch(/brain|seed|rng/i);
      // Methods must live on the prototype, never as own props (they would
      // break socket.io serialization size and determinism).
      expect(
        typeof (aibot as unknown as Record<string, unknown>)[key]
      ).not.toBe("function");
    }
    // The test accessor is a prototype getter, not an own property.
    expect(Object.prototype.hasOwnProperty.call(aibot, "seedForTest")).toBe(
      false
    );
    expect(aibot.seedForTest).toBeTypeOf("number");
  });

  it("round-trips through JSON without throwing (plain data only)", () => {
    const aibot = new AIBot(
      { x: 50, y: 50 },
      "bot3",
      "Bot4_ 0",
      "red",
      "red",
      "bot4",
      7
    );
    const wire = JSON.parse(JSON.stringify(aibot)) as Record<string, unknown>;
    expect(wire.kind).toBe("bot4");
    expect(wire.socketid).toBe("bot3");
    expect(wire.bullet_size).toEqual({ w: 20, h: 20 });
  });
});
