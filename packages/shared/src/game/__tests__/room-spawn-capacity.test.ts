import { Room } from "../Room.js";
import { loadlevel } from "../level_loader.js";
import { makeGrid, idx } from "./fixtures/levels.js";

// ensure_spawn_capacity: deterministic BFS top-up of the player spawn pool so
// N coop humans can spawn on solo levels authored with a single spawn cell.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Cell = [number, number, number];
const withBorder = (cells: Cell[]): number[] => {
  const ring: Cell[] = [];
  for (let c = 0; c < 23; c++) ring.push([0, c, 1], [15, c, 1]);
  for (let r = 1; r < 15; r++) ring.push([r, 0, 1], [r, 22, 1]);
  return makeGrid([...ring, ...cells] as never);
};

async function mkRoom(grid: number[]) {
  const room = new Room("arena", 1, [10], "creator", null);
  await loadlevel([...grid], room);
  return room;
}

const cellOf = (s: { x: number; y: number }) => idx(s.y / 50, s.x / 50);

describe("ensure_spawn_capacity", () => {
  it("tops a 1-spawn level up to 4 distinct walkable slots, ring by ring", async () => {
    const room = await mkRoom(withBorder([[8, 11, 3]]));
    expect(room.spawns).toHaveLength(1);

    room.ensure_spawn_capacity(4);
    expect(room.spawns).toHaveLength(4);
    // First ring around (8,11) in N,E,S order (W would be the 4th).
    expect(room.spawns.slice(1)).toEqual([
      { x: 11 * 50, y: 7 * 50 },
      { x: 12 * 50, y: 8 * 50 },
      { x: 11 * 50, y: 9 * 50 },
    ]);
    expect(new Set(room.spawns.map(cellOf)).size).toBe(4);
  });

  it("is deterministic (two identical rooms grow identical pools)", async () => {
    const a = await mkRoom(withBorder([[8, 11, 3]]));
    const b = await mkRoom(withBorder([[8, 11, 3]]));
    a.ensure_spawn_capacity(4);
    b.ensure_spawn_capacity(4);
    expect(a.spawns).toEqual(b.spawns);
  });

  it("skips walls, holes and bot cells", async () => {
    const room = await mkRoom(
      withBorder([
        [8, 11, 3],
        [7, 11, 1], // wall N
        [8, 12, 4], // hole E
        [9, 11, 15], // miner spawn S
      ])
    );
    room.ensure_spawn_capacity(2);
    expect(room.spawns).toHaveLength(2);
    // W is the first free first-ring cell.
    expect(room.spawns[1]).toEqual({ x: 10 * 50, y: 8 * 50 });
  });

  it("treats destroyed-wall floor (code 10) as walkable", async () => {
    const grid = withBorder([[8, 11, 3]]);
    grid[idx(7, 11)] = 10;
    const room = await mkRoom(grid);
    room.ensure_spawn_capacity(2);
    expect(room.spawns[1]).toEqual({ x: 11 * 50, y: 7 * 50 });
  });

  it("never hands out a cell a player already spawned on", async () => {
    const room = await mkRoom(withBorder([[8, 11, 3]]));
    room.spawn_new_player("A", "orange", "blue", "h1"); // consumes (8,11)
    expect(room.spawns).toHaveLength(0);

    room.ensure_spawn_capacity(2);
    expect(room.spawns).toHaveLength(2);
    const taken = cellOf(room.players.h1!.spawnpos);
    expect(room.spawns.map(cellOf)).not.toContain(taken);
  });

  it("is a no-op when the pool is already big enough", async () => {
    const room = await mkRoom(
      withBorder([
        [8, 10, 3],
        [8, 12, 3],
      ])
    );
    const before = [...room.spawns];
    room.ensure_spawn_capacity(2);
    expect(room.spawns).toEqual(before);
  });

  it("exhausts gracefully on a sealed spawn (no throw, partial fill)", async () => {
    const room = await mkRoom(
      withBorder([
        [8, 11, 3],
        [7, 10, 1],
        [7, 11, 1],
        [7, 12, 1],
        [8, 10, 1],
        [8, 12, 1],
        [9, 10, 1],
        [9, 11, 1],
        [9, 12, 1],
      ])
    );
    room.ensure_spawn_capacity(4);
    expect(room.spawns).toHaveLength(1); // only the original — nothing reachable
  });

  it("is a no-op on a grid with no spawn anchors at all", async () => {
    const room = await mkRoom(withBorder([]));
    room.ensure_spawn_capacity(4);
    expect(room.spawns).toHaveLength(0);
  });
});
