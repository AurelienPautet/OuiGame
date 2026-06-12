import { Room } from "../Room.js";
import { Player } from "../Player.js";
import { AIBot } from "../ai/index.js";
import { loadlevel } from "../level_loader.js";
import { twoSpawnArena, makeRecordingIo } from "./fixtures/levels.js";

// The lobby/coop Room fields land dark: every default must keep solo and
// legacy-online behaviour identical, and the new winner-check guard must hold
// a lobby-frozen room forever.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("lobby/coop defaults are inert", () => {
  it("a fresh Room is a playing ffa room with no lobby state", () => {
    const room = new Room("arena", 1, [10], "creator", null);
    expect(room.status).toBe("playing");
    expect(room.mode).toBe("ffa");
    expect(room.hostid).toBe("");
    expect(room.lobby_bots).toEqual([]);
    expect(room.lobby_bot_counter).toBe(0);
  });

  it("a fresh Player is a human awaiting nothing; an AIBot self-flags", () => {
    const player = new Player({ x: 0, y: 0 }, "p1", "P", "orange", "blue");
    expect(player.is_bot).toBe(false);
    expect(player.pending_spawn).toBe(false);
    const bot = new AIBot({ x: 0, y: 0 }, "b", "B", "blue", "blue", "bot1", 1);
    expect(bot.is_bot).toBe(true);
  });
});

describe("winner check while status is lobby", () => {
  it("never ends a round, even with 2 players and nbliving <= 1", async () => {
    const { io, emitted } = makeRecordingIo();
    const room = new Room("arena", 1, [10], "creator", io);
    await loadlevel([...twoSpawnArena], room);
    room.spawn_new_player("A", "orange", "blue", "h1");
    room.spawn_new_player("B", "orange", "blue", "h2");
    room.kill(room.players.h1!, room.players.h2!, "bullet");

    room.status = "lobby";
    expect(room.check_for_winns_and_load_next_level()).toBe(false);
    expect(emitted.filter((e) => e.event === "winner")).toHaveLength(0);
    expect(room.waitingrespawn).toBe(false);

    // The exact same room state ends the round once it is playing.
    room.status = "playing";
    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    expect(emitted.filter((e) => e.event === "winner")).toHaveLength(1);
  });
});

describe("delete_player bookkeeping", () => {
  it("prunes human_players (and human_count tracks it)", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    await loadlevel([...twoSpawnArena], room);
    room.spawn_new_player("A", "orange", "blue", "h1");
    room.spawn_new_player("B", "orange", "blue", "h2");
    expect(room.human_count()).toBe(2);

    room.delete_player("h1");
    expect(room.human_players).toEqual(["h2"]);
    expect(room.human_count()).toBe(1);
  });

  it("does not return a spawn slot for a pending_spawn joiner", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    await loadlevel([...twoSpawnArena], room);
    room.spawn_new_player("A", "orange", "blue", "h1");
    const pooled = room.spawns.length;

    room.add_waiting_player("Late", "orange", "blue", "h2");
    room.delete_player("h2");
    // The waiting joiner never owned a slot; returning their parked
    // {-100,-100} spawnpos would poison the pool.
    expect(room.spawns).toHaveLength(pooled);
    expect(room.spawns.every((s) => s.x >= 0 && s.y >= 0)).toBe(true);
  });

  it("skips the auto-respawn while a round-end respawn is pending", async () => {
    const { io, emitted } = makeRecordingIo();
    const room = new Room("arena", 1, [10], "creator", io);
    await loadlevel([...twoSpawnArena], room);
    room.spawn_new_player("A", "orange", "blue", "h1");
    room.spawn_new_player("B", "orange", "blue", "h2");
    room.kill(room.players.h1!, room.players.h2!, "bullet");
    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    expect(room.waitingrespawn).toBe(true);

    // The last alive player quits during the 5s scoreboard wait. The old code
    // ran respawn_the_room() right here, racing the server's scheduled one.
    emitted.length = 0;
    room.delete_player("h1");
    expect(room.nbliving).toBe(0);
    expect(room.waitingrespawn).toBe(true);
    expect(emitted.filter((e) => e.event === "level_change")).toHaveLength(0);
  });

  it("still auto-respawns when no round-end respawn is pending", async () => {
    const { io, emitted } = makeRecordingIo();
    const room = new Room("arena", 1, [10], "creator", io);
    await loadlevel([...twoSpawnArena], room);
    room.spawn_new_player("A", "orange", "blue", "h1");
    room.spawn_new_player("B", "orange", "blue", "h2");

    // A mid-round disconnect of the last living tank (no winner fired —
    // pretend B already left normally) keeps the historical behaviour.
    room.delete_player("h2");
    emitted.length = 0;
    room.delete_player("h1");
    expect(emitted.filter((e) => e.event === "level_change")).toHaveLength(1);
  });
});
