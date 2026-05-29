const request = require("supertest");
const { buildApp } = require("../helpers/app");
// Same module instance the API router uses, so setRoomsRef affects GET /api/rooms.
const roomsRoutes = require("../../routes/rooms.routes");

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
});
