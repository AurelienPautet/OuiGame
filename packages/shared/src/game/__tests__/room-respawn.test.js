import { Room } from "../Room.js";
import { Player } from "../Player.js";
import { makeRecordingIo } from "./fixtures/levels.js";

// Characterization tests for respawn_the_room: it clears projectiles, re-spawns
// every player, resets nbliving/waitingrespawn, and cycles levelid (advancing,
// then wrapping back to 0 past the last level). Math.random pinned for spawns.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

it("clears projectiles, re-spawns players, and advances the level", () => {
  const { io, emitted } = makeRecordingIo();
  const room = new Room("arena", 1, [10, 20], "creator", io);
  const p = new Player({ x: 0, y: 0 }, "p", "Alice", "orange", "blue");
  p.alive = false;
  room.players = { p };
  room.spawns = [{ x: 300, y: 300 }];
  room.bullets = [{}, {}];
  room.mines = [{}];
  room.levelid = 0;

  room.respawn_the_room();

  expect(room.bullets).toEqual([]);
  expect(room.mines).toEqual([]);
  expect(p.alive).toBe(true);
  expect(p.position).toEqual({ x: 300, y: 300 });
  expect(room.nbliving).toBe(1);
  expect(room.waitingrespawn).toBe(false);
  expect(room.levelid).toBe(1); // advanced
  expect(emitted.some((e) => e.event === "level_change")).toBe(true);
});

it("wraps levelid back to 0 after the last level", () => {
  const room = new Room("arena", 1, [10, 20], "creator");
  const p = new Player({ x: 0, y: 0 }, "p", "Alice", "orange", "blue");
  room.players = { p };
  room.spawns = [{ x: 1, y: 1 }];
  room.levelid = 1; // last index of a 2-level list

  room.respawn_the_room();

  expect(room.levelid).toBe(0);
});
