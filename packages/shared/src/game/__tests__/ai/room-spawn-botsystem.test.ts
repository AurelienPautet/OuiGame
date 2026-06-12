import { Room } from "../../Room.js";
import { Bot } from "../../Bot.js";
import { AIBot } from "../../ai/index.js";

// Room.bot_system selects which AI class spawn_all_bots constructs. The
// contract: ids, names, colors, spawn-pool consumption and skipIds numbering
// are byte-identical between systems — only the class (the brain) differs.
// Math.random is pinned so spawn-slot selection is deterministic (mirrors
// room-lifecycle.test.ts).

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const mkRoom = () => {
  const room = new Room("arena", 1, [10], "creator", null);
  room.bot1_spawns = [{ x: 0, y: 0 }];
  room.bot2_spawns = [{ x: 50, y: 0 }];
  room.bot3_spawns = [{ x: 100, y: 0 }];
  room.bot4_spawns = [{ x: 150, y: 0 }];
  return room;
};

describe("Room.bot_system default", () => {
  it("is legacy, and spawns legacy Bot instances", () => {
    const room = mkRoom();
    expect(room.bot_system).toBe("legacy");

    room.spawn_all_bots();

    expect(Object.keys(room.players)).toEqual(["bot0", "bot1", "bot2", "bot3"]);
    for (const id of ["bot0", "bot1", "bot2", "bot3"]) {
      expect(room.players[id]).toBeInstanceOf(Bot);
      expect(room.players[id]).not.toBeInstanceOf(AIBot);
    }
  });
});

describe("Room.bot_system = v2", () => {
  it("spawns AIBots with identical ids, names, colors and kinds", () => {
    const room = mkRoom();
    room.bot_system = "v2";

    room.spawn_all_bots();

    expect(Object.keys(room.players)).toEqual(["bot0", "bot1", "bot2", "bot3"]);
    const expected = [
      { id: "bot0", kind: "bot1", name: "Bot1_ 0", color: "blue" },
      { id: "bot1", kind: "bot2", name: "Bot2_ 0", color: "green" },
      { id: "bot2", kind: "bot3", name: "Bot3_ 0", color: "orange" },
      { id: "bot3", kind: "bot4", name: "Bot4_ 0", color: "red" },
    ] as const;
    for (const e of expected) {
      const bot = room.players[e.id];
      expect(bot).toBeInstanceOf(AIBot);
      expect((bot as AIBot).kind).toBe(e.kind);
      expect(bot!.name).toBe(e.name);
      expect(bot!.turretc).toBe(e.color);
      expect(bot!.bodyc).toBe(e.color);
    }
    expect(room.nbliving).toBe(4);
    expect(room.human_players).toEqual([]);
  });

  it("applies the per-kind chassis (same bullets/ammo as legacy kinds)", () => {
    const room = mkRoom();
    room.bot_system = "v2";
    room.spawn_all_bots();

    const [b1, b2, b3, b4] = [
      room.players.bot0!,
      room.players.bot1!,
      room.players.bot2!,
      room.players.bot3!,
    ];
    // bot1/bot2: 300 px/s, 3 bounces, 15px bullets — like legacy.
    expect(b1.shoot_speed).toBe(300);
    expect(b2.shoot_speed).toBe(300);
    // bot3: fast direct shots, dies on its 1st wall contact.
    expect(b3.shoot_speed).toBe(600);
    expect(b3.shoot_max_bounce).toBe(1);
    // bot4: fast heavy bullets.
    expect(b4.shoot_speed).toBe(600);
    expect(b4.bullet_size).toEqual({ w: 20, h: 20 });
    // Mines only on the mobile kinds; stationary kinds can't escape a blast.
    expect(b1.max_minecount).toBe(0);
    expect(b2.max_minecount).toBe(2);
    expect(b3.max_minecount).toBe(2);
    expect(b4.max_minecount).toBe(0);
    for (const b of [b1, b2, b3, b4]) {
      expect(b.max_bulletcount).toBe(3);
    }
  });

  it("derives distinct, room-seed-stable per-bot RNG seeds", () => {
    const room = mkRoom();
    room.bot_system = "v2";
    room.bot_seed = 0xabc123;
    room.spawn_all_bots();

    const seeds = ["bot0", "bot1", "bot2", "bot3"].map(
      (id) => (room.players[id] as AIBot).seedForTest
    );
    expect(new Set(seeds).size).toBe(4);

    const again = mkRoom();
    again.bot_system = "v2";
    again.bot_seed = 0xabc123;
    again.spawn_all_bots();
    expect((again.players.bot0 as AIBot).seedForTest).toBe(seeds[0]);
  });

  it("keeps skipIds numbering identical to the legacy system", () => {
    const room = new Room("arena", 1, [10], "creator", null);
    room.bot_system = "v2";
    room.bot1_spawns = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ];
    room.bot2_spawns = [{ x: 100, y: 0 }];

    // Same scenario as the legacy room-lifecycle test: bot0 and bot2 defeated.
    room.spawn_all_bots(new Set(["bot0", "bot2"]));

    expect(Object.keys(room.players)).toEqual(["bot1"]);
    expect(room.players.bot1).toBeInstanceOf(AIBot);
    expect(room.nbliving).toBe(1);
  });
});
