// The tick loop's DB deps are mocked; rooms are lightweight fakes whose update()
// we control, so we can drive round-end → stats → respawn → countdown without
// the real Room/DB. Fake timers + advanceTimersByTimeAsync handle the
// setTimeout-with-awaits respawn flow.
jest.mock("../../services/levels.service", () => ({
  getLevelJson: jest.fn(),
  getLevel: jest.fn(),
}));
jest.mock("../../repositories/ratings.repo", () => ({ getRating: jest.fn() }));
jest.mock("../../repositories/stats.repo", () => ({ insertRound: jest.fn() }));
// Achievement evaluation is exercised in achievements.service.test.ts; here it's
// a no-op so the loop's round-recording mechanics stay the unit under test.
jest.mock("../../services/achievements.service", () => ({
  evaluateOnlineRound: jest.fn().mockResolvedValue([]),
}));

import { createTickLoop } from "../../game/tickLoop";
import * as levelsService from "../../services/levels.service";
import * as ratingsRepo from "../../repositories/ratings.repo";
import * as statsRepo from "../../repositories/stats.repo";
import * as achievementsService from "../../services/achievements.service";
import { users } from "../../shared_state";
import { makeIo } from "../helpers/socketDoubles";

type RoomTimers = Map<
  number,
  { respawn?: NodeJS.Timeout; countdown?: NodeJS.Timeout }
>;

let perfSpy: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  // createTickLoop() captures oldTime = performance.now() = 1000. Each test then
  // bumps this so the first tick sees a real elapsed gap and the fixed-timestep
  // accumulator runs at least one step (the loop only steps when time elapses).
  perfSpy = jest.spyOn(performance, "now").mockReturnValue(1000);
  (levelsService.getLevelJson as jest.Mock).mockResolvedValue({
    data: new Array(368).fill(0),
  });
  (levelsService.getLevel as jest.Mock).mockResolvedValue({ level_id: 101 });
  (ratingsRepo.getRating as jest.Mock).mockResolvedValue(3);
  (statsRepo.insertRound as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => {
  for (const k of Object.keys(users)) delete users[k];
  jest.clearAllTimers();
  jest.useRealTimers();
  perfSpy.mockRestore();
});

// Minimal room fake. update() returns true exactly once (a single round end) by
// default unless `roundEnds` is false.
function makeRoom(id: number, roundEnds: boolean) {
  return {
    id,
    levels: [101],
    levelid: 0,
    players: {} as Record<string, any>,
    io: makeIo(),
    countdownActive: false,
    countdownDuration: 3000,
    update: jest.fn().mockReturnValueOnce(roundEnds).mockReturnValue(false),
    respawn_the_room: jest.fn(),
  };
}

function mkPlayer() {
  return {
    round_stats: {
      stats: {
        kills: 1,
        deaths: 0,
        wins: 1,
        shots: 4,
        hits: 2,
        plants: 0,
        blocks_destroyed: 0,
      },
      reset: jest.fn(),
    },
  };
}

test("advances the sim in fixed dt steps, independent of timer jitter", async () => {
  const room = makeRoom(1, false);
  const rooms = { 1: room };
  const roomTimers: RoomTimers = new Map();
  const loop = createTickLoop({
    io: makeIo() as never,
    rooms: rooms as never,
    roomTimers,
  });

  perfSpy.mockReturnValue(1100); // first tick sees ~100ms elapsed → fixed steps run
  loop.start();
  await jest.advanceTimersByTimeAsync(40);

  // Every step advances the room by exactly one fixed dt (1/60 s); the real
  // elapsed time only decides how many steps run, never their size.
  expect(room.update).toHaveBeenLastCalledWith(expect.closeTo(1 / 60, 4));
  expect(room.update.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test("on round end, records each player's round then schedules a respawn", async () => {
  users["p1"] = { playerId: 42, username: "p1", email: "p1@e.com" };
  const player = mkPlayer();
  const room = makeRoom(2, true);
  room.players = { p1: player };
  const rooms = { 2: room };
  const roomTimers: RoomTimers = new Map();
  const loop = createTickLoop({
    io: makeIo() as never,
    rooms: rooms as never,
    roomTimers,
  });

  perfSpy.mockReturnValue(1100); // first tick sees ~100ms elapsed → fixed steps run
  loop.start();
  await jest.advanceTimersByTimeAsync(20);

  expect(statsRepo.insertRound).toHaveBeenCalledWith(
    42,
    101,
    player.round_stats.stats
  );
  expect(player.round_stats.reset).toHaveBeenCalledTimes(1);
  expect(roomTimers.get(2)?.respawn).toBeDefined();
});

test("records a null playerId for a socket with no logged-in user", async () => {
  const player = mkPlayer();
  const room = makeRoom(3, true);
  room.players = { anon: player };
  const rooms = { 3: room };
  const loop = createTickLoop({
    io: makeIo() as never,
    rooms: rooms as never,
    roomTimers: new Map(),
  });

  perfSpy.mockReturnValue(1100); // first tick sees ~100ms elapsed → fixed steps run
  loop.start();
  await jest.advanceTimersByTimeAsync(20);

  expect(statsRepo.insertRound).toHaveBeenCalledWith(
    null,
    101,
    player.round_stats.stats
  );
  // Anonymous round → achievements are never evaluated.
  expect(achievementsService.evaluateOnlineRound).not.toHaveBeenCalled();
});

test("evaluates achievements for a logged-in player's round", async () => {
  users["p1"] = { playerId: 42, username: "p1", email: "p1@e.com" };
  const player = mkPlayer();
  const room = makeRoom(7, true);
  room.players = { p1: player };
  const loop = createTickLoop({
    io: makeIo() as never,
    rooms: { 7: room } as never,
    roomTimers: new Map(),
  });

  perfSpy.mockReturnValue(1100);
  loop.start();
  await jest.advanceTimersByTimeAsync(20);

  // Evaluated with the round-stats snapshot (same values as the player's stats).
  expect(achievementsService.evaluateOnlineRound).toHaveBeenCalledWith(
    42,
    player.round_stats.stats
  );
});

test("skips the round insert when the level list is empty", async () => {
  const player = mkPlayer();
  const room = makeRoom(4, true);
  room.levels = [];
  room.players = { p1: player };
  const rooms = { 4: room };
  const loop = createTickLoop({
    io: makeIo() as never,
    rooms: rooms as never,
    roomTimers: new Map(),
  });

  perfSpy.mockReturnValue(1100); // first tick sees ~100ms elapsed → fixed steps run
  loop.start();
  await jest.advanceTimersByTimeAsync(20);

  expect(statsRepo.insertRound).not.toHaveBeenCalled();
});

test("after the wait, reloads + respawns the room and runs the countdown", async () => {
  users["p1"] = { playerId: 42, username: "p1", email: "p1@e.com" };
  const room = makeRoom(5, true);
  room.players = { p1: mkPlayer() };
  const rooms = { 5: room };
  const roomTimers: RoomTimers = new Map();
  const loop = createTickLoop({
    io: makeIo() as never,
    rooms: rooms as never,
    roomTimers,
  });

  perfSpy.mockReturnValue(1100); // first tick sees ~100ms elapsed → fixed steps run
  loop.start();
  await jest.advanceTimersByTimeAsync(20); // round-end tick arms the respawn
  await jest.advanceTimersByTimeAsync(5100); // respawn fires (waitingtime = 5000)

  expect(room.respawn_the_room).toHaveBeenCalledTimes(1);
  expect(room.countdownActive).toBe(true);

  await jest.advanceTimersByTimeAsync(3100); // countdownDuration = 3000
  expect(room.countdownActive).toBe(false);
});

test("aborts the respawn if the room was deleted during the wait", async () => {
  const room = makeRoom(6, true);
  room.players = { p1: mkPlayer() };
  const rooms: Record<number, unknown> = { 6: room };
  const loop = createTickLoop({
    io: makeIo() as never,
    rooms: rooms as never,
    roomTimers: new Map(),
  });

  perfSpy.mockReturnValue(1100); // first tick sees ~100ms elapsed → fixed steps run
  loop.start();
  await jest.advanceTimersByTimeAsync(20); // respawn armed
  delete rooms[6]; // room emptied/removed mid-wait
  await jest.advanceTimersByTimeAsync(5100);

  expect(room.respawn_the_room).not.toHaveBeenCalled();
});
