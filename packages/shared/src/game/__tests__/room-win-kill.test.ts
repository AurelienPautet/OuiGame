import { Room } from "../Room.js";
import { Player } from "../Player.js";
import { makeRecordingIo } from "./fixtures/levels.js";

// Characterization tests for the round-end logic: kill() bookkeeping and the
// check_for_winns_and_load_next_level win/tie/solo gate that tickLoop relies on
// to know a round is over. Outputs frozen from the live implementation.

const mkRoom = (io = null) => new Room("arena", 1, [10], "creator", io);

const addPlayer = (room, id, pos, alive = true) => {
  const p = new Player(pos, id, id, "orange", "blue");
  p.alive = alive;
  room.players[id] = p;
  room.ids.push(id);
  room.ids_to_names[id] = id;
  return p;
};

describe("Room.kill", () => {
  it("flips alive, credits the kill/death, decrements nbliving, and emits", () => {
    const { io, emitted } = makeRecordingIo();
    const room = mkRoom(io);
    const killer = addPlayer(room, "k", { x: 0, y: 0 });
    const killed = addPlayer(room, "v", { x: 100, y: 100 });
    room.nbliving = 2;

    room.kill(killer, killed, "bullet");

    expect(killed.alive).toBe(false);
    expect(killer.round_stats.stats.kills).toBe(1);
    expect(killed.round_stats.stats.deaths).toBe(1);
    expect(room.nbliving).toBe(1);
    expect(room.sounds.kill).toBe(true);

    const kill = emitted.find((e) => e.event === "player-kill");
    expect(kill.data).toEqual({ players: ["k", "v"], type: "bullet" });
    const boom = emitted.find((e) => e.event === "player_explosion");
    expect(boom.data.position).toEqual({ x: 122.5, y: 122.5 }); // killed centre
  });
});

describe("Room.check_for_winns_and_load_next_level", () => {
  it("declares the last survivor the winner and locks for respawn", () => {
    const { io, emitted } = makeRecordingIo();
    const room = mkRoom(io);
    const survivor = addPlayer(room, "s1", { x: 0, y: 0 }, true);
    addPlayer(room, "s2", { x: 100, y: 100 }, false);
    room.nbliving = 1;

    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    expect(survivor.round_stats.stats.wins).toBe(1);
    expect(room.waitingrespawn).toBe(true);
    const winner = emitted.find((e) => e.event === "winner");
    expect(winner.data.socketid).toBe("s1");
  });

  it("emits a draw (socketid -1) when everyone is dead", () => {
    const { io, emitted } = makeRecordingIo();
    const room = mkRoom(io);
    addPlayer(room, "s1", { x: 0, y: 0 }, false);
    addPlayer(room, "s2", { x: 100, y: 100 }, false);
    room.nbliving = 0;

    expect(room.check_for_winns_and_load_next_level()).toBe(true);
    const winner = emitted.find((e) => e.event === "winner");
    expect(winner.data.socketid).toBe(-1);
  });

  it("never ends a round with fewer than two players (solo)", () => {
    const room = mkRoom();
    addPlayer(room, "s1", { x: 0, y: 0 }, true);
    room.nbliving = 1;
    expect(room.check_for_winns_and_load_next_level()).toBe(false);
    expect(room.waitingrespawn).toBe(false);
  });

  it("does not fire twice while already waiting for respawn", () => {
    const room = mkRoom();
    addPlayer(room, "s1", { x: 0, y: 0 }, true);
    addPlayer(room, "s2", { x: 100, y: 100 }, false);
    room.nbliving = 1;
    room.waitingrespawn = true;
    expect(room.check_for_winns_and_load_next_level()).toBe(false);
  });
});

describe("Room.get_all_player_stats", () => {
  it("maps each socket id to its round stats object", () => {
    const room = mkRoom();
    const p1 = addPlayer(room, "s1", { x: 0, y: 0 });
    const p2 = addPlayer(room, "s2", { x: 100, y: 100 });
    p1.round_stats.stats.kills = 2;
    expect(room.get_all_player_stats()).toEqual({
      s1: p1.round_stats.stats,
      s2: p2.round_stats.stats,
    });
  });
});
