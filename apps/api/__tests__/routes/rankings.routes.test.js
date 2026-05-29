const request = require("supertest");
const { buildApp } = require("../helpers/app");
const {
  cleanDb,
  createUserWithSession,
  createLevel,
  createRound,
} = require("../helpers/db");

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
});

describe("GET /api/rankings/:type", () => {
  test("ranks players by total kills (descending)", async () => {
    const sharp = await createUserWithSession({
      username: "sharpshooter",
      email: "sharp@example.com",
    });
    const rookie = await createUserWithSession({
      username: "rookie",
      email: "rookie@example.com",
    });
    const level = await createLevel(sharp.player.id);

    await createRound(sharp.player.id, level.id, { kills: 10 });
    await createRound(rookie.player.id, level.id, { kills: 2 });

    const res = await request(app).get("/api/rankings/KILLS");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].username).toBe("sharpshooter");
    expect(Number(res.body[0].total_data)).toBe(10);
    expect(Number(res.body[0].rank)).toBe(1);
    expect(res.body[1].username).toBe("rookie");
  });

  test("rejects an invalid ranking type (400)", async () => {
    const res = await request(app).get("/api/rankings/BOGUS");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid ranking type/i);
  });
});

describe("GET /api/rankings/:type/me", () => {
  test("returns the authenticated player's own rank entry", async () => {
    const me = await createUserWithSession({
      username: "me",
      email: "me@example.com",
    });
    const rival = await createUserWithSession({
      username: "rival",
      email: "rival@example.com",
    });
    const level = await createLevel(me.player.id);
    await createRound(me.player.id, level.id, { wins: 5 });
    await createRound(rival.player.id, level.id, { wins: 9 });

    const res = await request(app)
      .get("/api/rankings/WINS/me")
      .set("Authorization", me.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("me");
    expect(Number(res.body.total_data)).toBe(5);
  });

  test("rejects an invalid ranking type (400)", async () => {
    const { authHeader } = await createUserWithSession();
    const res = await request(app)
      .get("/api/rankings/NOPE/me")
      .set("Authorization", authHeader);
    expect(res.status).toBe(400);
  });
});
