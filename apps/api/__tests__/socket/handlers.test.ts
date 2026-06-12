// registerSocketHandlers is fully dependency-injected, so we capture the
// io.on("connect") callback, run it against a fake socket to register the
// per-event handlers, then invoke each handler directly. DB/auth deps are
// mocked.
jest.mock("../../auth/session", () => ({ verifySession: jest.fn() }));
jest.mock("../../services/levels.service", () => ({
  getLevelJson: jest.fn(),
  getLevel: jest.fn(),
}));
jest.mock("../../repositories/ratings.repo", () => ({ getRating: jest.fn() }));

import { registerSocketHandlers } from "../../socket/handlers";
import { verifySession } from "../../auth/session";
import * as levelsService from "../../services/levels.service";
import * as ratingsRepo from "../../repositories/ratings.repo";
import { users } from "../../shared_state";
import { makeIo, makeSocket } from "../helpers/socketDoubles";

const SERVER_ID = "srv1";
const flush = () => new Promise((r) => setImmediate(r));

function setup({ token }: { token?: string } = {}) {
  const io = makeIo();
  let connectHandler: ((socket: unknown) => void) | undefined;
  io.on = jest.fn((event: string, cb: (socket: unknown) => void) => {
    if (event === "connect") connectHandler = cb;
  }) as never;

  const rooms: Record<number, any> = {};
  const room_list = jest.fn();
  const create_room = jest.fn().mockResolvedValue(99);
  const broadcast_lobby_state = jest.fn();
  const deleteRoomIfEmpty = jest.fn();

  registerSocketHandlers({
    io: io as never,
    serverid: SERVER_ID,
    rooms,
    roomTimers: new Map(),
    room_list,
    create_room,
    broadcast_lobby_state,
    deleteRoomIfEmpty,
  });

  const socket = makeSocket("s1", token ? { token } : {});
  connectHandler!(socket);
  return {
    io,
    rooms,
    room_list,
    create_room,
    broadcast_lobby_state,
    deleteRoomIfEmpty,
    socket,
  };
}

function roomStub(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    ids: [] as string[],
    players: {} as Record<string, any>,
    human_players: [] as string[],
    lobby_bots: [] as string[],
    maxplayernb: 2,
    levels: [101],
    levelid: 0,
    blocks: [],
    Bcollision: [],
    countdownActive: false,
    status: "playing",
    mode: "ffa",
    hostid: "",
    countdownDuration: 3000,
    io: makeIo(),
    spawn_new_player: jest.fn(),
    delete_player: jest.fn(),
    spawn_lobby_bot: jest.fn(),
    remove_player_quiet: jest.fn(),
    // Mirrors Room.seat_count (coop: humans; ffa: every combatant).
    seat_count(this: { players: Record<string, unknown> }) {
      return Object.keys(this.players).length;
    },
    ...overrides,
  };
}

function playerStub() {
  return {
    position: { x: 0, y: 0 },
    mytick: 0,
    direction: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    shoot: jest.fn(),
    plant: jest.fn(),
  };
}

afterEach(() => {
  for (const k of Object.keys(users)) delete users[k];
});

describe("connect", () => {
  test("lists rooms, joins the lobby, and announces ids", () => {
    const { socket, room_list } = setup();
    expect(room_list).toHaveBeenCalledWith(socket);
    expect(socket.join).toHaveBeenCalledWith("lobby" + SERVER_ID);
    expect(socket.emit).toHaveBeenCalledWith("serverid", SERVER_ID);
    expect(socket.emit).toHaveBeenCalledWith("socketid", "s1");
  });
});

describe("authenticate / deauthenticate", () => {
  test("stores the user and replies authenticated:true for a valid token", async () => {
    (verifySession as jest.Mock).mockResolvedValue({
      playerId: 7,
      username: "u",
      email: "e@x.com",
    });
    const { socket } = setup();
    await socket.__emit("authenticate", "good");
    expect(users["s1"]).toMatchObject({ playerId: 7 });
    expect(socket.emit).toHaveBeenCalledWith("authenticated", true);
  });

  test("clears the user and replies authenticated:false for an invalid token", async () => {
    (verifySession as jest.Mock).mockResolvedValue(null);
    const { socket } = setup();
    users["s1"] = { playerId: 1, username: "x", email: "y" };
    await socket.__emit("authenticate", "bad");
    expect(users["s1"]).toBeUndefined();
    expect(socket.emit).toHaveBeenCalledWith("authenticated", false);
  });

  test("deauthenticate drops the in-memory user", () => {
    const { socket } = setup();
    users["s1"] = { playerId: 1, username: "x", email: "y" };
    socket.__emit("deauthenticate");
    expect(users["s1"]).toBeUndefined();
  });

  test("authenticates from the handshake token on connect", async () => {
    (verifySession as jest.Mock).mockResolvedValue({
      playerId: 9,
      username: "h",
      email: "h@x.com",
    });
    setup({ token: "handshake-token" });
    await flush();
    expect(users["s1"]).toMatchObject({ playerId: 9 });
  });
});

describe("tock — flood guard", () => {
  test("drops events past the per-window limit", () => {
    jest.spyOn(performance, "now").mockReturnValue(1000); // single window
    const { socket, rooms } = setup();
    const player = playerStub();
    rooms[1] = roomStub({ players: { s1: player } });

    for (let i = 0; i < 150; i++) {
      socket.__emit("tock", { serverid: SERVER_ID, room_id: 1, mytick: 5 });
    }
    expect(player.mytick).toBe(5);

    // The 151st event in the window is dropped before it can mutate the player.
    socket.__emit("tock", { serverid: SERVER_ID, room_id: 1, mytick: 999 });
    expect(player.mytick).toBe(5);
  });
});

describe("tock — input handling", () => {
  test("ignores input during the countdown", () => {
    const { socket, rooms } = setup();
    const player = playerStub();
    rooms[1] = roomStub({ players: { s1: player }, countdownActive: true });
    socket.__emit("tock", {
      serverid: SERVER_ID,
      room_id: 1,
      direction: { x: 1, y: 0 },
    });
    expect(player.direction).toEqual({ x: 0, y: 0 });
  });

  test("applies only well-formed vectors and fires shoot/plant", () => {
    const { socket, rooms } = setup();
    const player = playerStub();
    rooms[1] = roomStub({ players: { s1: player } });
    socket.__emit("tock", {
      serverid: SERVER_ID,
      room_id: 1,
      direction: { x: 1, y: 0 }, // valid
      aim: { x: "1", y: 2 }, // invalid -> ignored
      click: true,
      plant: true,
    });
    expect(player.direction).toEqual({ x: 1, y: 0 });
    expect(player.aim).toEqual({ x: 0, y: 0 }); // unchanged
    expect(player.shoot).toHaveBeenCalledWith(rooms[1]);
    expect(player.plant).toHaveBeenCalledWith(rooms[1]);
  });

  test("rejects a mismatched server id", () => {
    const { socket, rooms } = setup();
    rooms[1] = roomStub({ players: { s1: playerStub() } });
    socket.__emit("tock", { serverid: "other", room_id: 1 });
    expect(socket.emit).toHaveBeenCalledWith("wrongserver");
  });

  test("is a no-op when the room or player is missing", () => {
    const { socket } = setup();
    expect(() =>
      socket.__emit("tock", { serverid: SERVER_ID, room_id: 999 })
    ).not.toThrow();
  });
});

describe("play — join validation", () => {
  test("emits id-fail for an unknown room", () => {
    const { socket } = setup();
    socket.__emit("play", "Alice", "o", "b", 999);
    expect(socket.emit).toHaveBeenCalledWith("id-fail");
  });

  test("emits id-fail when the room is full", () => {
    const { socket, rooms } = setup();
    rooms[1] = roomStub({ maxplayernb: 1, players: { other: {} } });
    socket.__emit("play", "Alice", "o", "b", 1);
    expect(socket.emit).toHaveBeenCalledWith("id-fail");
  });

  test("emits id-fail when already joined", () => {
    const { socket, rooms } = setup();
    rooms[1] = roomStub({ ids: ["s1"] });
    socket.__emit("play", "Alice", "o", "b", 1);
    expect(socket.emit).toHaveBeenCalledWith("id-fail");
  });

  test("spawns the player and broadcasts on a valid join", async () => {
    (levelsService.getLevel as jest.Mock).mockResolvedValue({ level_id: 101 });
    const { socket, rooms, room_list, io } = setup();
    const room = roomStub();
    rooms[1] = room;

    socket.__emit("play", "Alice", "orange", "blue", 1);
    await flush();

    expect(room.spawn_new_player).toHaveBeenCalledWith(
      "Alice",
      "orange",
      "blue",
      "s1"
    );
    expect(socket.emit).toHaveBeenCalledWith("id", 1, expect.any(Number), "s1");
    expect(socket.join).toHaveBeenCalledWith("1");
    expect(room_list).toHaveBeenCalledWith(0);
    expect(io.__emits.some((e) => e.event === "player-connection")).toBe(true);
  });
});

describe("quit / disconnect / leave_game", () => {
  test("quit leaves the game and rejoins the lobby", () => {
    const { socket, rooms, deleteRoomIfEmpty, room_list } = setup();
    rooms[1] = roomStub();
    socket.__emit("quit");
    expect(rooms[1].delete_player).toHaveBeenCalledWith("s1");
    expect(deleteRoomIfEmpty).toHaveBeenCalled();
    expect(room_list).toHaveBeenCalledWith(0);
    expect(socket.join).toHaveBeenCalledWith("lobby" + SERVER_ID);
  });

  test("disconnect drops the user then leaves the game", () => {
    const { socket, rooms } = setup();
    users["s1"] = { playerId: 1, username: "x", email: "y" };
    rooms[1] = roomStub();
    socket.__emit("disconnect");
    expect(users["s1"]).toBeUndefined();
    expect(rooms[1].delete_player).toHaveBeenCalledWith("s1");
  });

  test("leave_game swallows a delete_player error and still re-lists", () => {
    const { socket, rooms, room_list } = setup();
    rooms[1] = roomStub({
      delete_player: jest.fn(() => {
        throw new Error("boom");
      }),
    });
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => socket.__emit("quit")).not.toThrow();
    expect(room_list).toHaveBeenCalledWith(0);
  });
});

describe("get_json_from_id / new-room", () => {
  test("emits the level json on success", async () => {
    (levelsService.getLevelJson as jest.Mock).mockResolvedValue({ data: [1] });
    const { socket } = setup();
    socket.__emit("get_json_from_id", 5);
    await flush();
    expect(socket.emit).toHaveBeenCalledWith("recieve_json_from_id", {
      data: [1],
    });
  });

  test("emits an error when the level json is null", async () => {
    (levelsService.getLevelJson as jest.Mock).mockResolvedValue(null);
    const { socket } = setup();
    socket.__emit("get_json_from_id", 5);
    await flush();
    expect(socket.emit).toHaveBeenCalledWith(
      "error_getting_json",
      expect.any(String)
    );
  });

  test("emits an error when the lookup rejects", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    (levelsService.getLevelJson as jest.Mock).mockRejectedValue(
      new Error("db")
    );
    const { socket } = setup();
    socket.__emit("get_json_from_id", 5);
    await flush();
    expect(socket.emit).toHaveBeenCalledWith(
      "error_getting_json",
      expect.any(String)
    );
  });

  test("new-room creates the room (rounds forced to 10) and echoes the id", async () => {
    const { socket, create_room } = setup();
    await socket.__emit("new-room", "Arena", 3, [101], "alice");
    expect(create_room).toHaveBeenCalledWith(
      "Arena",
      10,
      [101],
      "alice",
      undefined,
      "s1" // the creator's socket pre-assigns the lobby host
    );
    expect(socket.emit).toHaveBeenCalledWith("room_created", 99);
  });

  test("new-room forwards the mode arg and relays a creation failure", async () => {
    const { socket, create_room } = setup();
    (create_room as jest.Mock).mockResolvedValue({ error: "coop_unavailable" });
    await socket.__emit("new-room", "Arena", 3, [101], "alice", "coop");
    expect(create_room).toHaveBeenCalledWith(
      "Arena",
      10,
      [101],
      "alice",
      "coop",
      "s1"
    );
    expect(socket.emit).toHaveBeenCalledWith(
      "room_create_failed",
      "coop_unavailable"
    );
    expect(socket.emit).not.toHaveBeenCalledWith(
      "room_created",
      expect.anything()
    );
  });
});
