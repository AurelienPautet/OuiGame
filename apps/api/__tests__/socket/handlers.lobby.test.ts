// The lobby control handlers: host assignment on first join, host-only
// add/remove-bot and start (with their guards), and host transfer when the
// host leaves. Rooms are stubs; the registry side is covered in
// game/roomRegistry.test.ts.
jest.mock("../../auth/session", () => ({ verifySession: jest.fn() }));
jest.mock("../../services/levels.service", () => ({
  getLevelJson: jest.fn(),
  getLevel: jest.fn(),
}));
jest.mock("../../repositories/ratings.repo", () => ({ getRating: jest.fn() }));

import { registerSocketHandlers } from "../../socket/handlers";
import * as levelsService from "../../services/levels.service";
import { users } from "../../shared_state";
import { makeIo, makeSocket, type FakeSocket } from "../helpers/socketDoubles";

const SERVER_ID = "srv1";
const flush = () => new Promise((r) => setImmediate(r));

type RoomTimers = Map<
  number,
  { respawn?: NodeJS.Timeout; countdown?: NodeJS.Timeout }
>;

function setup() {
  const io = makeIo();
  let connectHandler: ((socket: unknown) => void) | undefined;
  io.on = jest.fn((event: string, cb: (socket: unknown) => void) => {
    if (event === "connect") connectHandler = cb;
  }) as never;

  const rooms: Record<number, any> = {};
  const roomTimers: RoomTimers = new Map();
  const room_list = jest.fn();
  const create_room = jest.fn().mockResolvedValue(99);
  const broadcast_lobby_state = jest.fn();
  const deleteRoomIfEmpty = jest.fn();

  registerSocketHandlers({
    io: io as never,
    serverid: SERVER_ID,
    rooms,
    roomTimers,
    room_list,
    create_room,
    broadcast_lobby_state,
    deleteRoomIfEmpty,
  });

  const connect = (id: string): FakeSocket => {
    const socket = makeSocket(id, {});
    connectHandler!(socket);
    return socket;
  };

  return {
    io,
    rooms,
    roomTimers,
    room_list,
    broadcast_lobby_state,
    deleteRoomIfEmpty,
    connect,
  };
}

// A lobby-held room stub whose membership mutators behave like the real Room
// (just enough for the handlers' reads).
function lobbyRoomStub(overrides: Record<string, unknown> = {}) {
  const room: any = {
    id: 1,
    ids: [] as string[],
    players: {} as Record<string, any>,
    human_players: [] as string[],
    lobby_bots: [] as string[],
    maxplayernb: 4,
    levels: [101],
    levelid: 0,
    blocks: [],
    Bcollision: [],
    status: "lobby",
    mode: "ffa",
    hostid: "",
    countdownActive: true,
    countdownDuration: 3000,
    io: makeIo(),
    spawn_new_player: jest.fn(
      (name: string, t: string, b: string, id: string) => {
        room.players[id] = { name };
        room.ids.push(id);
        room.human_players.push(id);
      }
    ),
    delete_player: jest.fn((id: string) => {
      delete room.players[id];
      const i = room.ids.indexOf(id);
      if (i !== -1) room.ids.splice(i, 1);
      const h = room.human_players.indexOf(id);
      if (h !== -1) room.human_players.splice(h, 1);
    }),
    spawn_lobby_bot: jest.fn(() => {
      const id = `lobbybot_${room.lobby_bots.length}`;
      room.players[id] = { name: id, is_bot: true };
      room.ids.push(id);
      room.lobby_bots.push(id);
      return room.players[id];
    }),
    remove_player_quiet: jest.fn((id: string) => {
      delete room.players[id];
      const i = room.ids.indexOf(id);
      if (i !== -1) room.ids.splice(i, 1);
      const l = room.lobby_bots.indexOf(id);
      if (l !== -1) room.lobby_bots.splice(l, 1);
    }),
    ...overrides,
  };
  return room;
}

beforeEach(() => {
  // Fake timers drive the lobby_start countdown; setImmediate stays real so
  // the flush() helper (microtask drain after async handlers) keeps working.
  jest.useFakeTimers({ doNotFake: ["setImmediate"] });
  (levelsService.getLevel as jest.Mock).mockResolvedValue({ level_id: 101 });
});
afterEach(() => {
  for (const k of Object.keys(users)) delete users[k];
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe("host assignment", () => {
  test("the first human to join becomes host; the second does not steal it", async () => {
    const { rooms, connect, broadcast_lobby_state } = setup();
    const room = lobbyRoomStub();
    rooms[1] = room;

    const host = connect("s1");
    host.__emit("play", "Alice", "o", "b", 1);
    await flush();
    expect(room.hostid).toBe("s1");
    expect(broadcast_lobby_state).toHaveBeenCalledWith(room);

    const guest = connect("s2");
    guest.__emit("play", "Bob", "o", "b", 1);
    await flush();
    expect(room.hostid).toBe("s1");
  });
});

describe("lobby_add_bot", () => {
  test("host adds a bot → spawn + lobby_state + room_list", () => {
    const { rooms, connect, broadcast_lobby_state, room_list } = setup();
    const room = lobbyRoomStub({ hostid: "s1" });
    rooms[1] = room;
    const host = connect("s1");
    (room_list as jest.Mock).mockClear();

    host.__emit("lobby_add_bot", 1);
    expect(room.spawn_lobby_bot).toHaveBeenCalledTimes(1);
    expect(broadcast_lobby_state).toHaveBeenCalledWith(room);
    expect(room_list).toHaveBeenCalledWith(0);
  });

  test("rejected for a non-host", () => {
    const { rooms, connect } = setup();
    const room = lobbyRoomStub({ hostid: "someone-else" });
    rooms[1] = room;
    connect("s1").__emit("lobby_add_bot", 1);
    expect(room.spawn_lobby_bot).not.toHaveBeenCalled();
  });

  test("rejected once the room is playing", () => {
    const { rooms, connect } = setup();
    const room = lobbyRoomStub({ hostid: "s1", status: "playing" });
    rooms[1] = room;
    connect("s1").__emit("lobby_add_bot", 1);
    expect(room.spawn_lobby_bot).not.toHaveBeenCalled();
  });

  test("rejected in a coop room", () => {
    const { rooms, connect } = setup();
    const room = lobbyRoomStub({ hostid: "s1", mode: "coop" });
    rooms[1] = room;
    connect("s1").__emit("lobby_add_bot", 1);
    expect(room.spawn_lobby_bot).not.toHaveBeenCalled();
  });

  test("rejected at capacity (bots hold real seats)", () => {
    const { rooms, connect } = setup();
    const room = lobbyRoomStub({
      hostid: "s1",
      maxplayernb: 2,
      players: { s1: {}, lobbybot_0: {} },
    });
    rooms[1] = room;
    connect("s1").__emit("lobby_add_bot", 1);
    expect(room.spawn_lobby_bot).not.toHaveBeenCalled();
  });
});

describe("lobby_remove_bot", () => {
  test("host removes a bot it added", () => {
    const { rooms, connect, broadcast_lobby_state } = setup();
    const room = lobbyRoomStub({ hostid: "s1" });
    rooms[1] = room;
    const host = connect("s1");
    host.__emit("lobby_add_bot", 1);
    (broadcast_lobby_state as jest.Mock).mockClear();

    host.__emit("lobby_remove_bot", 1, "lobbybot_0");
    expect(room.remove_player_quiet).toHaveBeenCalledWith("lobbybot_0", true);
    expect(broadcast_lobby_state).toHaveBeenCalledWith(room);
  });

  test("only lobby-bot ids qualify (humans are never removable)", () => {
    const { rooms, connect } = setup();
    const room = lobbyRoomStub({
      hostid: "s1",
      players: { s2: { name: "Bob" } },
      ids: ["s2"],
      human_players: ["s2"],
    });
    rooms[1] = room;
    connect("s1").__emit("lobby_remove_bot", 1, "s2");
    expect(room.remove_player_quiet).not.toHaveBeenCalled();
  });
});

describe("lobby_start", () => {
  test("host starts with 2 combatants: status flips, countdown runs, broadcasts fire", () => {
    const { rooms, roomTimers, connect, broadcast_lobby_state, room_list } =
      setup();
    const room = lobbyRoomStub({
      hostid: "s1",
      players: { s1: {}, lobbybot_0: { is_bot: true } },
    });
    rooms[1] = room;
    (room_list as jest.Mock).mockClear();

    connect("s1").__emit("lobby_start", 1);
    expect(room.status).toBe("playing");
    expect(room.countdownActive).toBe(true);
    // countdown_start must reach the STRING-keyed socket.io room.
    const cd = room.io.__emits.find(
      (e: { event: string }) => e.event === "countdown_start"
    );
    expect(cd).toBeDefined();
    expect(cd.target).toBe("1");
    expect(roomTimers.get(1)?.countdown).toBeDefined();
    expect(broadcast_lobby_state).toHaveBeenCalledWith(room);
    expect(room_list).toHaveBeenCalledWith(0);

    jest.advanceTimersByTime(3100);
    expect(room.countdownActive).toBe(false);
  });

  test("a lone human cannot start an ffa room (instant-win guard)", () => {
    const { rooms, connect } = setup();
    const room = lobbyRoomStub({ hostid: "s1", players: { s1: {} } });
    rooms[1] = room;
    connect("s1").__emit("lobby_start", 1);
    expect(room.status).toBe("lobby");
  });

  test("non-host start is ignored", () => {
    const { rooms, connect } = setup();
    const room = lobbyRoomStub({
      hostid: "s1",
      players: { s1: {}, s2: {} },
    });
    rooms[1] = room;
    connect("s2").__emit("lobby_start", 1);
    expect(room.status).toBe("lobby");
  });
});

describe("host transfer on leave", () => {
  test("quit hands the crown to the next human and rebroadcasts", () => {
    const { rooms, connect, broadcast_lobby_state } = setup();
    const room = lobbyRoomStub();
    rooms[1] = room;
    const host = connect("s1");
    const guest = connect("s2");
    host.__emit("play", "Alice", "o", "b", 1);
    guest.__emit("play", "Bob", "o", "b", 1);
    expect(room.hostid).toBe("s1");
    (broadcast_lobby_state as jest.Mock).mockClear();

    host.__emit("quit");
    expect(room.hostid).toBe("s2");
    expect(broadcast_lobby_state).toHaveBeenCalledWith(room);
  });

  test("a non-member leaving does not rebroadcast or touch the host", () => {
    const { rooms, connect, broadcast_lobby_state } = setup();
    const room = lobbyRoomStub({ hostid: "s9", players: { s9: {} } });
    rooms[1] = room;
    connect("s1").__emit("quit");
    expect(room.hostid).toBe("s9");
    expect(broadcast_lobby_state).not.toHaveBeenCalled();
  });
});
