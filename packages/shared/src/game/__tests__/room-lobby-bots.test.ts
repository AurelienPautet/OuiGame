import { Room } from "../Room.js";
import { Player } from "../Player.js";
import { AIBot } from "../ai/index.js";
import { loadlevel } from "../level_loader.js";
import { makeGrid, makeRecordingIo } from "./fixtures/levels.js";

// Host-added lobby bots: player-equal chassis (kind bot7), player spawn slots,
// lobbybot_<n> ids that are never reused, and a quiet removal that does not
// toast a disconnect.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

// Four interior player spawns.
const fourSpawnArena = makeGrid([
  [4, 4, 3],
  [4, 8, 3],
  [4, 12, 3],
  [4, 16, 3],
] as never);

async function mkRoom() {
  const { io, emitted } = makeRecordingIo();
  const room = new Room("arena", 1, [10], "creator", io);
  await loadlevel([...fourSpawnArena], room);
  return { room, emitted };
}

describe("spawn_lobby_bot", () => {
  it("registers a player-equal bot on a player spawn slot", async () => {
    const { room } = await mkRoom();
    const pooled = room.spawns.length;

    const bot = room.spawn_lobby_bot();
    expect(bot).toBeInstanceOf(AIBot);
    expect(bot!.kind).toBe("bot7");
    expect(bot!.is_bot).toBe(true);
    expect(bot!.socketid).toBe("lobbybot_0");
    expect(bot!.name).toBe("Bot 1");
    expect(bot!.turretc).toBe("dimgray");
    expect(bot!.bodyc).toBe("dimgray");

    expect(room.players.lobbybot_0).toBe(bot);
    expect(room.ids).toContain("lobbybot_0");
    expect(room.ids_to_names.lobbybot_0).toBe("Bot 1");
    expect(room.lobby_bots).toEqual(["lobbybot_0"]);
    expect(room.human_players).toEqual([]);
    expect(room.spawns).toHaveLength(pooled - 1);
    expect(room.nbliving).toBe(1);
  });

  it("drives exactly the tank a human gets, field for field", () => {
    const human = new Player({ x: 0, y: 0 }, "h", "H", "orange", "blue");
    const bot = new AIBot({ x: 0, y: 0 }, "b", "B", "a", "a", "bot7", 1);
    expect(bot.mvtspeed).toBe(human.mvtspeed);
    expect(bot.shoot_speed).toBe(human.shoot_speed);
    expect(bot.shoot_max_bounce).toBe(human.shoot_max_bounce);
    expect(bot.bullet_type).toBe(human.bullet_type);
    expect(bot.bullet_size).toEqual(human.bullet_size);
    expect(bot.max_bulletcount).toBe(human.max_bulletcount);
    expect(bot.max_minecount).toBe(human.max_minecount);
  });

  it("never reuses an id across add → remove → add", async () => {
    const { room } = await mkRoom();
    room.spawn_lobby_bot();
    room.spawn_lobby_bot();
    room.remove_player_quiet("lobbybot_0", true);
    const third = room.spawn_lobby_bot();

    expect(third!.socketid).toBe("lobbybot_2");
    expect(third!.name).toBe("Bot 3");
    expect(room.lobby_bots).toEqual(["lobbybot_1", "lobbybot_2"]);
    expect(room.lobby_bot_counter).toBe(3);
  });

  it("returns null (and burns no id) when no player spawn is free", async () => {
    const { room } = await mkRoom();
    room.spawns = [];
    expect(room.spawn_lobby_bot()).toBeNull();
    expect(room.lobby_bot_counter).toBe(0);
    expect(room.lobby_bots).toEqual([]);
  });
});

describe("remove_player_quiet", () => {
  it("removes without a player-disconnection toast and returns the spawn", async () => {
    const { room, emitted } = await mkRoom();
    const pooled = room.spawns.length;
    room.spawn_lobby_bot();
    emitted.length = 0;

    room.remove_player_quiet("lobbybot_0", true);
    expect(
      emitted.filter((e) => e.event === "player-disconnection")
    ).toHaveLength(0);
    expect(room.players.lobbybot_0).toBeUndefined();
    expect(room.ids).not.toContain("lobbybot_0");
    expect(room.ids_to_names.lobbybot_0).toBeUndefined();
    expect(room.lobby_bots).toEqual([]);
    expect(room.spawns).toHaveLength(pooled);
    expect(room.nbliving).toBe(0);
  });

  it("keeps the slot when return_spawn is false (coop round cleanup)", async () => {
    const { room } = await mkRoom();
    room.spawn_lobby_bot();
    const pooledAfterSpawn = room.spawns.length;

    room.remove_player_quiet("lobbybot_0", false);
    expect(room.spawns).toHaveLength(pooledAfterSpawn);
  });

  it("is a no-op for an unknown socketid", async () => {
    const { room } = await mkRoom();
    room.spawn_lobby_bot();
    room.remove_player_quiet("nope", true);
    expect(Object.keys(room.players)).toEqual(["lobbybot_0"]);
    expect(room.nbliving).toBe(1);
  });
});
