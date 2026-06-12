// roomRegistry orchestrates the in-memory rooms map + per-room timers. Its DB
// deps (levelsService/levelsRepo) and the HTTP shared-ref hook (rooms.routes)
// are mocked so the registry logic is exercised in isolation.
jest.mock("../../services/levels.service", () => ({
  getLevelJson: jest.fn(),
  getLevel: jest.fn(),
  validateCoopLevels: jest.fn(),
}));
jest.mock("../../repositories/levels.repo", () => ({
  getMinMaxPlayers: jest.fn(),
}));
jest.mock("../../routes/rooms.routes", () => ({ setRoomsRef: jest.fn() }));

import { createRoomRegistry } from "../../game/roomRegistry";
import * as levelsService from "../../services/levels.service";
import * as levelsRepo from "../../repositories/levels.repo";
import { setRoomsRef } from "../../routes/rooms.routes";
import { makeIo, makeSocket } from "../helpers/socketDoubles";

const SERVER_ID = "srv1";

beforeEach(() => {
  jest.useFakeTimers();
  (levelsRepo.getMinMaxPlayers as jest.Mock).mockResolvedValue({ min: 2 });
  (levelsService.getLevelJson as jest.Mock).mockResolvedValue({
    data: new Array(368).fill(0),
  });
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const mkReg = (io = makeIo()) => ({
  io,
  reg: createRoomRegistry({ io, serverid: SERVER_ID }),
});

test("shares the SAME rooms reference with the HTTP layer at construction", () => {
  const { reg } = mkReg();
  expect(setRoomsRef).toHaveBeenCalledWith(reg.rooms);
});

// create_room returns `number | { error }`; the suite's happy paths expect ids.
const asId = (r: number | { error: string }): number => {
  if (typeof r !== "number") throw new Error(`expected id, got ${r.error}`);
  return r;
};

describe("create_room", () => {
  test("constructs a room, sets max players, registers it, and broadcasts the list", async () => {
    const { io, reg } = mkReg();
    const id = asId(await reg.create_room("Arena", 10, [101], "alice"));

    expect(reg.rooms[id]).toBeDefined();
    expect(reg.rooms[id]!.name).toBe("Arena");
    expect(reg.rooms[id]!.maxplayernb).toBe(2);
    // room_list(0) broadcast to the lobby channel for this server.
    const broadcast = io.__emits.find(
      (e) => e.event === "room_list" && e.target === "lobby" + SERVER_ID
    );
    expect(broadcast).toBeDefined();
  });

  test("without a mode arg (old clients) the room plays immediately", async () => {
    const { reg } = mkReg();
    const id = asId(await reg.create_room("Arena", 10, [101], "alice"));
    expect(reg.rooms[id]!.status).toBe("playing");
    expect(reg.rooms[id]!.mode).toBe("ffa");
    expect(reg.rooms[id]!.countdownActive).toBe(false);
  });

  test("with mode 'ffa' the room is born held in a lobby", async () => {
    const { reg } = mkReg();
    const id = asId(await reg.create_room("Arena", 10, [101], "alice", "ffa"));
    expect(reg.rooms[id]!.status).toBe("lobby");
    expect(reg.rooms[id]!.mode).toBe("ffa");
    // The indefinite pre-start hold reuses the between-rounds input freeze.
    expect(reg.rooms[id]!.countdownActive).toBe(true);
  });

  test("the creator's socket pre-assigns the lobby host", async () => {
    const { reg } = mkReg();
    const id = asId(
      await reg.create_room("Arena", 10, [101], "alice", "ffa", "sock-creator")
    );
    // Never listed hostless: a faster joiner can no longer claim the lobby
    // before the creator's own play lands.
    expect(reg.rooms[id]!.hostid).toBe("sock-creator");
  });

  test("legacy rooms (no mode) never get a host pre-assigned", async () => {
    const { reg } = mkReg();
    const id = asId(
      await reg.create_room("Arena", 10, [101], "alice", undefined, "sock-x")
    );
    expect(reg.rooms[id]!.hostid).toBe("");
  });

  test("a validated coop room: lobby-held, v2 bots, human cap of 4", async () => {
    const { reg } = mkReg();
    (levelsService.validateCoopLevels as jest.Mock).mockResolvedValue({
      ok: true,
    });
    const id = asId(await reg.create_room("Arena", 10, [101], "alice", "coop"));
    const room = reg.rooms[id]!;
    expect(room.status).toBe("lobby");
    expect(room.mode).toBe("coop");
    expect(room.countdownActive).toBe(true);
    expect(room.bot_system).toBe("v2");
    expect(room.maxplayernb).toBe(4);
    // The playlist's (solo) maxPlayers values are irrelevant for coop.
    expect(levelsRepo.getMinMaxPlayers).not.toHaveBeenCalled();
  });

  test("a failed coop validation registers nothing and relays the reason", async () => {
    const { reg } = mkReg();
    (levelsService.validateCoopLevels as jest.Mock).mockResolvedValue({
      ok: false,
      reason: "no_bot_spawns",
    });
    const before = Object.keys(reg.rooms).length;
    const result = await reg.create_room("Arena", 10, [101], "alice", "coop");
    expect(result).toEqual({ error: "no_bot_spawns" });
    expect(Object.keys(reg.rooms)).toHaveLength(before);
  });
});

describe("broadcast_lobby_state", () => {
  test("emits the member list (host + bots flagged) to the string room channel", async () => {
    const { io, reg } = mkReg();
    // A level grid with two player spawn cells so real joins work.
    const grid = new Array(368).fill(0);
    grid[4 * 23 + 4] = 3;
    grid[4 * 23 + 8] = 3;
    (levelsService.getLevelJson as jest.Mock).mockResolvedValue({ data: grid });

    const id = asId(await reg.create_room("Arena", 10, [101], "alice", "ffa"));
    const room = reg.rooms[id]!;
    room.spawn_new_player("Alice", "orange", "blue", "s1");
    room.hostid = "s1";
    room.spawn_lobby_bot();

    reg.broadcast_lobby_state(room);
    const emit = io.__emits.find((e) => e.event === "lobby_state")!;
    expect(emit.target).toBe(String(id));
    expect(emit.args[0]).toEqual({
      room_id: id,
      name: "Arena",
      status: "lobby",
      mode: "ffa",
      max_players: 2,
      members: [
        {
          socketid: "s1",
          name: "Alice",
          turretc: "orange",
          bodyc: "blue",
          is_bot: false,
          is_host: true,
        },
        {
          socketid: "lobbybot_0",
          name: "Bot 1",
          turretc: "dimgray",
          bodyc: "dimgray",
          is_bot: true,
          is_host: false,
        },
      ],
    });
  });
});

describe("room_list", () => {
  test("emits the five parallel arrays to a single socket", async () => {
    const { reg } = mkReg();
    await reg.create_room("A", 10, [1], "alice");
    await reg.create_room("B", 10, [2], "bob");

    const socket = makeSocket();
    reg.room_list(socket);

    expect(socket.emit).toHaveBeenCalledTimes(1);
    const [event, ids, names, creators, players, maxes] =
      socket.emit.mock.calls[0]!;
    expect(event).toBe("room_list");
    expect(ids).toHaveLength(2);
    expect(names).toEqual(["A", "B"]);
    expect(creators).toEqual(["alice", "bob"]);
    expect(players).toEqual([0, 0]);
    expect(maxes).toEqual([2, 2]);
  });

  test("counts humans only for a coop room", async () => {
    const { reg } = mkReg();
    const grid = new Array(368).fill(0);
    grid[4 * 23 + 4] = 3;
    grid[4 * 23 + 8] = 3;
    (levelsService.getLevelJson as jest.Mock).mockResolvedValue({ data: grid });
    const id = asId(await reg.create_room("A", 10, [1], "alice", "ffa"));
    const room = reg.rooms[id]!;
    room.mode = "coop"; // until the coop PR, flipped manually for the count
    room.spawn_new_player("Alice", "o", "b", "s1");
    // A level bot in the players map must not count toward coop capacity.
    room.players["bot0"] = { is_bot: true } as never;

    const socket = makeSocket();
    reg.room_list(socket);
    const [, , , , players] = socket.emit.mock.calls[0]!;
    expect(players).toEqual([1]);
  });
});

describe("deleteRoomIfEmpty / clearRoomTimers", () => {
  test("removes an empty room and clears its pending timers", async () => {
    const { reg } = mkReg();
    const id = asId(await reg.create_room("A", 10, [1], "alice"));
    const room = reg.rooms[id]!;
    reg.roomTimers.set(id, {
      respawn: setTimeout(() => {}, 100000),
      countdown: setTimeout(() => {}, 100000),
    });
    const clearSpy = jest.spyOn(global, "clearTimeout");

    reg.deleteRoomIfEmpty(room);

    // Deletion is deferred by a grace period — nothing happens immediately.
    expect(reg.rooms[id]).toBeDefined();

    jest.advanceTimersByTime(3000);

    expect(clearSpy).toHaveBeenCalledTimes(2);
    expect(reg.roomTimers.has(id)).toBe(false);
    expect(reg.rooms[id]).toBeUndefined();
  });

  test("keeps a room if a HUMAN re-joins during the grace period", async () => {
    const { reg } = mkReg();
    const id = asId(await reg.create_room("A", 10, [1], "alice"));
    const room = reg.rooms[id]!;

    reg.deleteRoomIfEmpty(room); // last player left → schedule deletion
    // Someone re-joins before the grace elapses (registration the way
    // spawn_new_player does it: players map + human_players list).
    room.players = { back: {} as never };
    room.human_players.push("back");
    jest.advanceTimersByTime(3000);

    expect(reg.rooms[id]).toBeDefined();
  });

  test("keeps a room that still has a human", async () => {
    const { reg } = mkReg();
    const id = asId(await reg.create_room("A", 10, [1], "alice"));
    const room = reg.rooms[id]!;
    room.players = { someone: {} as never };
    room.human_players.push("someone");

    reg.deleteRoomIfEmpty(room);

    expect(reg.rooms[id]).toBeDefined();
  });

  test("deletes a room whose only remaining players are bots", async () => {
    const { reg } = mkReg();
    const grid = new Array(368).fill(0);
    grid[4 * 23 + 4] = 3;
    (levelsService.getLevelJson as jest.Mock).mockResolvedValue({ data: grid });
    const id = asId(await reg.create_room("A", 10, [1], "alice", "ffa"));
    const room = reg.rooms[id]!;
    room.spawn_lobby_bot();
    expect(Object.keys(room.players)).toHaveLength(1);

    reg.deleteRoomIfEmpty(room); // last human left; only the bot remains
    jest.advanceTimersByTime(3000);

    expect(reg.rooms[id]).toBeUndefined();
  });

  test("clearRoomTimers clears both handles and forgets the entry", async () => {
    const { reg } = mkReg();
    const id = asId(await reg.create_room("A", 10, [1], "alice"));
    reg.roomTimers.set(id, {
      respawn: setTimeout(() => {}, 100000),
      countdown: setTimeout(() => {}, 100000),
    });
    const clearSpy = jest.spyOn(global, "clearTimeout");

    reg.clearRoomTimers(id);

    expect(clearSpy).toHaveBeenCalledTimes(2);
    expect(reg.roomTimers.has(id)).toBe(false);
  });
});
