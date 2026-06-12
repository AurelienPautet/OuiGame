import { Room } from "../Room.js";
import { AIBot } from "../ai/index.js";
import { loadlevel } from "../level_loader.js";
import { makeGrid, makeRecordingIo } from "./fixtures/levels.js";
import type { WinnerPayload } from "../../types";

// Coop verdicts: the team wins when every bot is dead, loses when every human
// is dead — and a mutual wipe-out counts as a loss. One winner emit per round,
// additive `coop` field, first surviving human in `socketid` for old clients.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const arena = makeGrid([
  [4, 4, 3],
  [4, 8, 3],
  [4, 12, 3],
  [4, 16, 3],
] as never);

async function mkCoopRoom(humans: number, bots: number) {
  const { io, emitted } = makeRecordingIo();
  const room = new Room("arena", 1, [10], "creator", io);
  room.mode = "coop";
  await loadlevel([...arena], room);
  for (let i = 0; i < humans; i++) {
    room.spawn_new_player(`H${i}`, "orange", "blue", `h${i}`);
  }
  for (let i = 0; i < bots; i++) {
    const id = `bot${i}`;
    const bot = new AIBot({ x: 0, y: 0 }, id, id, "blue", "blue", "bot1", 1);
    room.spawns.push({ x: 100 + i * 100, y: 600 });
    room.spawn_new(bot, id, room.spawns);
  }
  const winners = () =>
    emitted
      .filter((e) => e.event === "winner")
      .map((e) => e.data as WinnerPayload);
  return { room, winners };
}

const killAll = (room: Room, pred: (id: string) => boolean) => {
  for (const id in room.players) {
    const p = room.players[id]!;
    if (pred(id) && p.alive) {
      p.alive = false;
      room.nbliving--;
    }
  }
};

describe("coop win", () => {
  it("fires once with coop:'win' when the last bot dies", async () => {
    const { room, winners } = await mkCoopRoom(2, 2);
    killAll(room, (id) => id.startsWith("bot"));

    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    const w = winners();
    expect(w).toHaveLength(1);
    expect(w[0]!.coop).toBe("win");
    expect(w[0]!.socketid).toBe("h0"); // first surviving human, for old clients
    expect(room.players.h0!.round_stats.stats.wins).toBe(1);
    expect(room.players.h1!.round_stats.stats.wins).toBe(1);
    expect(room.waitingrespawn).toBe(true);

    // No re-fire while the respawn is pending.
    expect(room.check_for_winns_and_load_next_level()).toBe(false);
    expect(winners()).toHaveLength(1);
  });

  it("works with a single human (no ≥2-players requirement)", async () => {
    const { room, winners } = await mkCoopRoom(1, 1);
    killAll(room, (id) => id.startsWith("bot"));
    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    expect(winners()[0]!.coop).toBe("win");
    expect(room.players.h0!.round_stats.stats.wins).toBe(1);
  });

  it("a dead human does not share the win", async () => {
    const { room, winners } = await mkCoopRoom(2, 1);
    killAll(room, (id) => id === "h0" || id.startsWith("bot"));
    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    expect(winners()[0]!.socketid).toBe("h1");
    expect(room.players.h0!.round_stats.stats.wins).toBe(0);
    expect(room.players.h1!.round_stats.stats.wins).toBe(1);
  });
});

describe("coop loss", () => {
  it("fires with coop:'loss' and socketid -1 when every human is dead", async () => {
    const { room, winners } = await mkCoopRoom(2, 2);
    killAll(room, (id) => id.startsWith("h"));

    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    const w = winners();
    expect(w).toHaveLength(1);
    expect(w[0]!.coop).toBe("loss");
    expect(w[0]!.socketid).toBe(-1);
  });

  it("a mutual wipe-out is a loss", async () => {
    const { room, winners } = await mkCoopRoom(1, 1);
    killAll(room, () => true);
    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    expect(winners()[0]!.coop).toBe("loss");
  });
});

describe("coop round still running", () => {
  it("returns false while both sides have survivors", async () => {
    const { room, winners } = await mkCoopRoom(2, 2);
    killAll(room, (id) => id === "h0" || id === "bot0");
    expect(room.check_for_winns_and_load_next_level()).toBe(false);
    expect(winners()).toHaveLength(0);
    expect(room.waitingrespawn).toBe(false);
  });
});

describe("ffa rounds are untouched", () => {
  it("emits winner WITHOUT the coop key", async () => {
    const { io, emitted } = makeRecordingIo();
    const room = new Room("arena", 1, [10], "creator", io);
    await loadlevel([...arena], room);
    room.spawn_new_player("A", "orange", "blue", "h1");
    room.spawn_new_player("B", "orange", "blue", "h2");
    room.kill(room.players.h1!, room.players.h2!, "bullet");

    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    const w = emitted.find((e) => e.event === "winner")!.data as WinnerPayload;
    expect(w.socketid).toBe("h1");
    expect("coop" in w).toBe(false);
  });
});
