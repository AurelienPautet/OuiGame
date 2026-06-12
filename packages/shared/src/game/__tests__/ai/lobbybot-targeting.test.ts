import { Room } from "../../Room.js";
import { loadlevel } from "../../level_loader.js";
import { SIM_STEP_S } from "../../loop.js";
import { targetIds, isProtectedBot } from "../../ai/allegiance.js";
import { pickTarget } from "../../ai/perception.js";
import { getAIRoomState, refreshPerTick } from "../../ai/room_state.js";
import { makeGrid, GRID_COLS, GRID_ROWS } from "../fixtures/levels.js";
import type { AIBot } from "../../ai/index.js";

// Allegiance: lobby bots are enemies of everyone and allies of nobody, while
// level bots keep the historical humans-only target set — byte-identical
// iteration when no lobby bots exist (the golden suites pin the rest).

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Cell = [number, number, number];
const withBorder = (cells: Cell[]): number[] => {
  const ring: Cell[] = [];
  for (let c = 0; c < GRID_COLS; c++) {
    ring.push([0, c, 1], [GRID_ROWS - 1, c, 1]);
  }
  for (let r = 1; r < GRID_ROWS - 1; r++) {
    ring.push([r, 0, 1], [r, GRID_COLS - 1, 1]);
  }
  return makeGrid([...ring, ...cells] as never);
};

const duelGrid = withBorder([
  [8, 4, 3],
  [8, 18, 3],
]);

describe("allegiance helpers", () => {
  it("targetIds returns human_players ITSELF with no lobby bots", () => {
    const room = new Room("arena", 1, [10], "creator", null);
    room.human_players.push("h1");
    expect(targetIds(room)).toBe(room.human_players);
  });

  it("targetIds appends lobby bots when present", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    await loadlevel([...duelGrid], room);
    room.spawn_new_player("A", "orange", "blue", "h1");
    room.spawn_lobby_bot();
    expect([...targetIds(room)]).toEqual(["h1", "lobbybot_0"]);
  });

  it("isProtectedBot shields level bots but not lobby bots or humans", () => {
    const room = new Room("arena", 1, [10], "creator", null);
    room.lobby_bots.push("lobbybot_0");
    expect(isProtectedBot(room, "bot0")).toBe(true);
    expect(isProtectedBot(room, "lobbybot_0")).toBe(false);
    expect(isProtectedBot(room, "a-human-socket-id")).toBe(false);
  });
});

describe("pickTarget with lobby bots", () => {
  it("two lobby bots acquire each other, never themselves", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    await loadlevel([...duelGrid], room);
    const a = room.spawn_lobby_bot()!;
    const b = room.spawn_lobby_bot()!;

    const s = getAIRoomState(room);
    room.tick = 1;
    refreshPerTick(room, s);

    expect(pickTarget(a, room, s, null)).toBe(b);
    expect(pickTarget(b, room, s, null)).toBe(a);
  });

  it("a lobby bot also targets humans (closest enemy wins)", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    await loadlevel([...duelGrid], room);
    room.spawn_new_player("H", "orange", "blue", "h1");
    const bot = room.spawn_lobby_bot()!;

    const s = getAIRoomState(room);
    room.tick = 1;
    refreshPerTick(room, s);
    expect(pickTarget(bot, room, s, null)).toBe(room.players.h1);
  });
});

describe("lobby bot duel sim", () => {
  it("two bot7s fight to a kill (FFA, no mutual protection)", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    room.bot_seed = 7;
    await loadlevel([...duelGrid], room);
    const a = room.spawn_lobby_bot()!;
    const b = room.spawn_lobby_bot()!;

    let ended = false;
    for (let t = 0; t < 7200 && !ended; t++) {
      ended = room.update(SIM_STEP_S);
    }

    expect(ended).toBe(true); // the FFA winner check fired — someone died
    const survivors = [a, b].filter((x) => x.alive);
    expect(survivors).toHaveLength(1);
    expect(survivors[0]!.round_stats.stats.wins).toBe(1);
    // Both genuinely engaged: the fight produced real shots from each side.
    expect(a.round_stats.stats.shots).toBeGreaterThan(0);
    expect(b.round_stats.stats.shots).toBeGreaterThan(0);
  });

  it("a lobby bot kills an idle human despite the bot-hazard veto", async () => {
    // Regression guard for checkPath: a lobby bot's own target must never
    // veto the shot (the old rule treated EVERY "bot" socketid as a friendly
    // obstacle, which would have made lobby bots hold fire on each other).
    const room = new Room("arena", 1, [10], "creator", null);
    room.bot_seed = 11;
    await loadlevel([...duelGrid], room);
    room.spawn_new_player("Idle", "orange", "blue", "h1");
    room.spawn_lobby_bot();

    let ended = false;
    for (let t = 0; t < 3600 && !ended; t++) {
      ended = room.update(SIM_STEP_S);
    }
    expect(ended).toBe(true);
    expect(room.players.h1!.alive).toBe(false);
  });
});

describe("lobby bot duel determinism", () => {
  it("the same seed replays the same fight", async () => {
    const run = async () => {
      const room = new Room("arena", 1, [10], "creator", null);
      room.bot_seed = 7;
      await loadlevel([...duelGrid], room);
      const a = room.spawn_lobby_bot()!;
      const b = room.spawn_lobby_bot()!;
      let ticks = 0;
      for (let t = 0; t < 7200; t++) {
        ticks++;
        if (room.update(SIM_STEP_S)) break;
      }
      return {
        ticks,
        aAlive: a.alive,
        bAlive: b.alive,
        aShots: a.round_stats.stats.shots,
        bShots: b.round_stats.stats.shots,
      };
    };
    expect(await run()).toEqual(await run());
  });
});
