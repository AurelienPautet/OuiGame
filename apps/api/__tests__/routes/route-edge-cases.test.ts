import request from "supertest";
import { buildApp } from "../helpers/app";
import {
  cleanDb,
  createUserWithSession,
  createLevel,
  createRound,
} from "../helpers/db";

// Net-new error/edge coverage that the per-route suites don't already exercise:
// the remaining ranking types, the null personal-rank case, rating bounds, and
// invalid-id / invalid-type rejections across routes.

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
});

describe("rankings — remaining types + null personal rank", () => {
  test("GET /api/rankings/ROUNDS_PLAYED ranks by rounds played", async () => {
    const a = await createUserWithSession({ username: "a", email: "a@x.com" });
    const b = await createUserWithSession({ username: "b", email: "b@x.com" });
    const level = await createLevel(a.player.id);
    await createRound(a.player.id, level.id, {});
    await createRound(a.player.id, level.id, {});
    await createRound(b.player.id, level.id, {});

    const res = await request(app).get("/api/rankings/ROUNDS_PLAYED");
    expect(res.status).toBe(200);
    expect(res.body[0].username).toBe("a");
    expect(Number(res.body[0].total_data)).toBe(2);
  });

  test("GET /api/rankings/:type/me returns null (200) for a player with no rounds", async () => {
    const { authHeader } = await createUserWithSession();
    const res = await request(app)
      .get("/api/rankings/KILLS/me")
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });
});

describe("levels — rating bounds + invalid id", () => {
  test("POST /api/levels/:id/rate rejects out-of-range stars (400)", async () => {
    const { player, authHeader } = await createUserWithSession();
    const level = await createLevel(player.id);

    for (const stars of [0, 6]) {
      const res = await request(app)
        .post(`/api/levels/${level.id}/rate`)
        .set("Authorization", authHeader)
        .send({ stars });
      expect(res.status).toBe(400);
    }

    const ok = await request(app)
      .post(`/api/levels/${level.id}/rate`)
      .set("Authorization", authHeader)
      .send({ stars: 4 });
    expect(ok.status).toBe(200);
  });

  test("GET /api/levels/:id rejects a non-numeric or zero id (400)", async () => {
    expect((await request(app).get("/api/levels/abc")).status).toBe(400);
    expect((await request(app).get("/api/levels/0")).status).toBe(400);
  });
});

describe("invalid types / ids on other routes", () => {
  test("GET /api/solo/leaderboard/:type rejects an unknown type (400)", async () => {
    const res = await request(app).get("/api/solo/leaderboard/BOGUS");
    expect(res.status).toBe(400);
  });

  test("GET /api/campaigns/:id rejects a non-numeric id (400)", async () => {
    const res = await request(app).get("/api/campaigns/abc");
    expect(res.status).toBe(400);
  });
});
