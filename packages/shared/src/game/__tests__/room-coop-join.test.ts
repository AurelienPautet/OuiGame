import { Room } from "../Room.js";
import { loadlevel } from "../level_loader.js";
import { twoSpawnArena } from "./fixtures/levels.js";

// Mid-round coop joiners: registered everywhere but off the field until the
// next respawn_the_room() deals them in.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("add_waiting_player", () => {
  it("registers a dead, off-field human without touching spawns or nbliving", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    await loadlevel([...twoSpawnArena], room);
    room.spawn_new_player("A", "orange", "blue", "h1");
    const pooled = room.spawns.length;

    room.add_waiting_player("Late", "green", "red", "h2");
    const late = room.players.h2!;
    expect(late.alive).toBe(false);
    expect(late.pending_spawn).toBe(true);
    expect(late.position).toEqual({ x: -100, y: -100 });
    expect(room.ids).toContain("h2");
    expect(room.ids_to_names.h2).toBe("Late");
    expect(room.human_players).toEqual(["h1", "h2"]);
    expect(room.human_count()).toBe(2);
    expect(room.spawns).toHaveLength(pooled);
    expect(room.nbliving).toBe(1);
  });

  it("the next respawn_the_room spawns them like everyone else", async () => {
    const room = new Room("arena", 1, [10], "creator", null);
    await loadlevel([...twoSpawnArena], room);
    room.spawn_new_player("A", "orange", "blue", "h1");
    room.add_waiting_player("Late", "green", "red", "h2");

    // The real round-end sequence: loadlevel refills the spawn pool, the coop
    // path tops it up to the human count, THEN everyone respawns.
    await loadlevel([...twoSpawnArena], room);
    room.ensure_spawn_capacity(room.human_count());
    room.respawn_the_room();
    const late = room.players.h2!;
    expect(late.alive).toBe(true);
    expect(late.pending_spawn).toBe(false);
    expect(late.position.x).toBeGreaterThanOrEqual(0);
    expect(room.nbliving).toBe(2);
  });
});
