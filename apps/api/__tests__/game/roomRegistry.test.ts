// roomRegistry orchestrates the in-memory rooms map + per-room timers. Its DB
// deps (levelsService/levelsRepo) and the HTTP shared-ref hook (rooms.routes)
// are mocked so the registry logic is exercised in isolation.
jest.mock("../../services/levels.service", () => ({
  getLevelJson: jest.fn(),
  getLevel: jest.fn(),
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

describe("create_room", () => {
  test("constructs a room, sets max players, registers it, and broadcasts the list", async () => {
    const { io, reg } = mkReg();
    const id = await reg.create_room("Arena", 10, [101], "alice");

    expect(reg.rooms[id]).toBeDefined();
    expect(reg.rooms[id]!.name).toBe("Arena");
    expect(reg.rooms[id]!.maxplayernb).toBe(2);
    // room_list(0) broadcast to the lobby channel for this server.
    const broadcast = io.__emits.find(
      (e) => e.event === "room_list" && e.target === "lobby" + SERVER_ID
    );
    expect(broadcast).toBeDefined();
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
});

describe("deleteRoomIfEmpty / clearRoomTimers", () => {
  test("removes an empty room and clears its pending timers", async () => {
    const { reg } = mkReg();
    const id = await reg.create_room("A", 10, [1], "alice");
    const room = reg.rooms[id]!;
    reg.roomTimers.set(id, {
      respawn: setTimeout(() => {}, 100000),
      countdown: setTimeout(() => {}, 100000),
    });
    const clearSpy = jest.spyOn(global, "clearTimeout");

    reg.deleteRoomIfEmpty(room);

    expect(clearSpy).toHaveBeenCalledTimes(2);
    expect(reg.roomTimers.has(id)).toBe(false);
    expect(reg.rooms[id]).toBeUndefined();
  });

  test("keeps a room that still has players", async () => {
    const { reg } = mkReg();
    const id = await reg.create_room("A", 10, [1], "alice");
    const room = reg.rooms[id]!;
    room.players = { someone: {} as never };

    reg.deleteRoomIfEmpty(room);

    expect(reg.rooms[id]).toBeDefined();
  });

  test("clearRoomTimers clears both handles and forgets the entry", async () => {
    const { reg } = mkReg();
    const id = await reg.create_room("A", 10, [1], "alice");
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
