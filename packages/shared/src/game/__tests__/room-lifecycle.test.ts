import { Room } from "../Room.js";
import { Bot } from "../Bot.js";
import { makeRecordingIo } from "./fixtures/levels.js";

// Characterization tests for Room player/bot lifecycle: spawning consumes the
// spawn pool, bot spawning preserves the global socketid numbering, and
// delete_player returns the spawn + triggers a respawn when the room empties.
// Math.random is pinned to 0 so spawn-slot selection is deterministic.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const mkRoom = (io = null) => new Room("arena", 1, [10], "creator", io);

describe("Room ids", () => {
  it("hands out a fresh incrementing id per room", () => {
    const a = mkRoom();
    const b = mkRoom();
    expect(b.id).toBe(a.id + 1);
  });
});

describe("Room.spawn_new_player", () => {
  it("registers the player everywhere and consumes a spawn slot", () => {
    const room = mkRoom();
    room.spawns = [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ];
    room.spawn_new_player("Alice", "orange", "blue", "s1");

    expect(Object.keys(room.players)).toEqual(["s1"]);
    expect(room.players.s1.position).toEqual({ x: 100, y: 100 });
    expect(room.ids).toEqual(["s1"]);
    expect(room.ids_to_names).toEqual({ s1: "Alice" });
    expect(room.human_players).toEqual(["s1"]);
    expect(room.nbliving).toBe(1);
    expect(room.spawns).toEqual([{ x: 200, y: 200 }]); // first slot consumed
  });

  it("still registers a player when the spawn pool is empty (position undefined)", () => {
    const room = mkRoom();
    room.spawns = [];
    room.spawn_new_player("Bob", "red", "red", "s2");
    expect(room.players.s2.position).toBeUndefined();
    expect(room.nbliving).toBe(1);
  });
});

describe("Room.spawn_all_bots", () => {
  it("spawns one bot per spawn cell with contiguous botN socketids", () => {
    const room = mkRoom();
    room.bot1_spawns = [{ x: 0, y: 0 }];
    room.bot2_spawns = [{ x: 50, y: 0 }];
    room.bot3_spawns = [{ x: 100, y: 0 }];
    room.bot4_spawns = [{ x: 150, y: 0 }];

    room.spawn_all_bots();

    expect(Object.keys(room.players)).toEqual(["bot0", "bot1", "bot2", "bot3"]);
    expect(room.players.bot0).toBeInstanceOf(Bot);
    expect(room.players.bot0.name).toBe("Bot1_ 0");
    expect(room.players.bot3.name).toBe("Bot4_ 0");
    expect(room.nbliving).toBe(4);
    expect(room.human_players).toEqual([]); // bots are not human players
  });

  it("skips bots in skipIds while keeping the others' socketids stable", () => {
    const room = mkRoom();
    room.bot1_spawns = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ];
    room.bot2_spawns = [{ x: 100, y: 0 }];

    // Pretend bot0 and bot2 were defeated on a previous campaign attempt.
    room.spawn_all_bots(new Set(["bot0", "bot2"]));

    // Only the survivor spawns, and it keeps the id it had before (bot1) — the
    // skipped slots still advance the counter, so numbering doesn't shift.
    expect(Object.keys(room.players)).toEqual(["bot1"]);
    expect(room.players.bot1).toBeInstanceOf(Bot);
    expect(room.nbliving).toBe(1);
  });
});

describe("Room.delete_player", () => {
  it("removes the player, returns its spawn, and decrements nbliving", () => {
    const { io, emitted } = makeRecordingIo();
    const room = mkRoom(io);
    room.spawns = [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
    ];
    room.spawn_new_player("Alice", "orange", "blue", "s1");
    room.spawn_new_player("Bob", "red", "red", "s2");
    const aliceSpawn = room.players.s1.spawnpos;

    room.delete_player("s1");

    expect(Object.keys(room.players)).toEqual(["s2"]);
    expect(room.ids).toEqual(["s2"]);
    expect(room.ids_to_names).toEqual({ s2: "Bob" });
    expect(room.nbliving).toBe(1);
    expect(room.spawns).toContainEqual(aliceSpawn);
    expect(emitted.some((e) => e.event === "player-disconnection")).toBe(true);
  });

  it("respawns the room when the last player leaves (nbliving hits 0)", () => {
    const { io, emitted } = makeRecordingIo();
    const room = mkRoom(io);
    room.spawns = [{ x: 100, y: 100 }];
    room.spawn_new_player("Solo", "orange", "blue", "s1");
    emitted.length = 0;

    room.delete_player("s1");

    expect(room.nbliving).toBe(0);
    // respawn_the_room broadcasts a fresh level_change.
    expect(emitted.some((e) => e.event === "level_change")).toBe(true);
  });

  it("is a no-op for an unknown socket id", () => {
    const room = mkRoom();
    expect(() => room.delete_player("ghost")).not.toThrow();
  });
});
