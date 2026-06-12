import request from "supertest";
import { buildApp } from "../helpers/app";
// Same module instance the API router uses, so setRoomsRef affects GET /api/rooms.
import * as roomsRoutes from "../../routes/rooms.routes";

const app = buildApp();

// Reset the shared module-level rooms reference before each test so tests are
// isolated and order-independent (no leaking state between cases).
beforeEach(() => {
  roomsRoutes.setRoomsRef({});
});

describe("GET /api/rooms", () => {
  test("returns an empty list when there are no rooms", async () => {
    const res = await request(app).get("/api/rooms");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("summarizes active rooms with player counts", async () => {
    roomsRoutes.setRoomsRef({
      abc: {
        id: "abc",
        name: "Battle Arena",
        creator: "gamemaster",
        players: { sock1: {}, sock2: {} },
        maxplayernb: 6,
      },
    });

    const res = await request(app).get("/api/rooms");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: "abc",
        name: "Battle Arena",
        creator: "gamemaster",
        players: 2,
        maxPlayers: 6,
      },
    ]);
  });

  test("surfaces status/mode and counts humans only for coop rooms", async () => {
    roomsRoutes.setRoomsRef({
      1: {
        id: 1,
        name: "Lobby Room",
        creator: "alice",
        players: { s1: {}, lobbybot_0: {} },
        maxplayernb: 4,
        status: "lobby",
        mode: "ffa",
        human_count: () => 1,
      },
      2: {
        id: 2,
        name: "Coop Run",
        creator: "bob",
        players: { s2: {}, bot0: {}, bot1: {} },
        maxplayernb: 4,
        status: "playing",
        mode: "coop",
        human_count: () => 1,
      },
    });

    const res = await request(app).get("/api/rooms");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        name: "Lobby Room",
        creator: "alice",
        // ffa counts every combatant — a lobby bot holds a real seat.
        players: 2,
        maxPlayers: 4,
        status: "lobby",
        mode: "ffa",
      },
      {
        id: 2,
        name: "Coop Run",
        creator: "bob",
        // coop counts humans only — level bots don't take seats.
        players: 1,
        maxPlayers: 4,
        status: "playing",
        mode: "coop",
      },
    ]);
  });
});
