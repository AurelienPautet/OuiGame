import request from "supertest";
import { buildApp } from "../helpers/app";
import {
  db,
  schema,
  cleanDb,
  createUserWithSession,
  createLevel,
  createSoloRound,
} from "../helpers/db";
import { eq } from "drizzle-orm";

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
});

describe("POST /api/solo/rounds", () => {
  test("records an anonymous round (no auth, playerId null)", async () => {
    const { player } = await createUserWithSession();
    const level = await createLevel(player.id, { type: "solo" });

    const res = await request(app)
      .post("/api/solo/rounds")
      .send({ levelId: level.id, success: true, timeMs: 4200 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rows = await db
      .select()
      .from(schema.soloRounds)
      .where(eq(schema.soloRounds.levelId, level.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].playerId).toBeNull();
    expect(rows[0].timeMs).toBe(4200);
  });

  test("attaches the player id when authenticated", async () => {
    const { player, authHeader } = await createUserWithSession();
    const level = await createLevel(player.id, { type: "solo" });

    const res = await request(app)
      .post("/api/solo/rounds")
      .set("Authorization", authHeader)
      .send({ levelId: level.id, success: false, timeMs: 999 });

    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(schema.soloRounds)
      .where(eq(schema.soloRounds.levelId, level.id));
    expect(rows[0].playerId).toBe(player.id);
  });

  test("rejects a body missing required fields (400)", async () => {
    const res = await request(app)
      .post("/api/solo/rounds")
      .send({ success: true, timeMs: 100 }); // no levelId
    expect(res.status).toBe(400);
  });
});

describe("GET /api/solo/levels/:id/stats", () => {
  test("computes play count, success rate and best time", async () => {
    const { player } = await createUserWithSession();
    const level = await createLevel(player.id, { type: "solo" });

    await createSoloRound(player.id, level.id, { success: true, timeMs: 5000 });
    await createSoloRound(player.id, level.id, { success: true, timeMs: 3000 });
    await createSoloRound(player.id, level.id, {
      success: false,
      timeMs: 2000,
    });

    const res = await request(app).get(`/api/solo/levels/${level.id}/stats`);
    expect(res.status).toBe(200);
    expect(res.body.timesPlayed).toBe(3);
    expect(res.body.successRate).toBe(67); // round(2/3 * 100)
    expect(res.body.bestTimeMs).toBe(3000); // fastest successful run
  });

  test("returns zeros for a level that has never been played", async () => {
    const { player } = await createUserWithSession();
    const level = await createLevel(player.id, { type: "solo" });

    const res = await request(app).get(`/api/solo/levels/${level.id}/stats`);
    expect(res.body.timesPlayed).toBe(0);
    expect(res.body.successRate).toBe(0);
    expect(res.body.bestTimeMs).toBeNull();
  });
});

describe("GET /api/solo/levels/:id/leaderboard", () => {
  test("lists best successful times, including anonymous players", async () => {
    const { player } = await createUserWithSession({ username: "speedy" });
    const level = await createLevel(player.id, { type: "solo" });

    // Logged-in player: two successful runs, best is 1500.
    await createSoloRound(player.id, level.id, { success: true, timeMs: 2500 });
    await createSoloRound(player.id, level.id, { success: true, timeMs: 1500 });
    // Anonymous run, slower.
    await createSoloRound(null, level.id, { success: true, timeMs: 4000 });
    // Failed run should be excluded.
    await createSoloRound(player.id, level.id, { success: false, timeMs: 10 });

    const res = await request(app).get(
      `/api/solo/levels/${level.id}/leaderboard`
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      rank: 1,
      username: "speedy",
      timeMs: 1500,
    });
    expect(res.body[1]).toMatchObject({
      rank: 2,
      username: "Anonymous",
      timeMs: 4000,
    });
  });
});

describe("GET /api/solo/leaderboard/:type", () => {
  test("ranks logged-in players by levels completed", async () => {
    const a = await createUserWithSession({
      username: "completionist",
      email: "a@example.com",
    });
    const b = await createUserWithSession({
      username: "casual",
      email: "b@example.com",
    });
    const l1 = await createLevel(a.player.id, { name: "L1", type: "solo" });
    const l2 = await createLevel(a.player.id, { name: "L2", type: "solo" });

    // a completes two distinct levels, b completes one.
    await createSoloRound(a.player.id, l1.id, { success: true });
    await createSoloRound(a.player.id, l2.id, { success: true });
    await createSoloRound(b.player.id, l1.id, { success: true });

    const res = await request(app).get(
      "/api/solo/leaderboard/LEVELS_COMPLETED"
    );
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      rank: 1,
      username: "completionist",
      total_data: 2,
    });
    expect(res.body[1].username).toBe("casual");
  });

  test("rejects an invalid leaderboard type (400)", async () => {
    const res = await request(app).get("/api/solo/leaderboard/WAT");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/solo/stats/me", () => {
  test("summarizes the authenticated player's solo performance", async () => {
    const { player, authHeader } = await createUserWithSession();
    const level = await createLevel(player.id, { type: "solo" });

    await createSoloRound(player.id, level.id, {
      success: true,
      kills: 5,
      shots: 10,
      hits: 5,
    });
    await createSoloRound(player.id, level.id, { success: false, kills: 1 });

    const res = await request(app)
      .get("/api/solo/stats/me")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.levelsCompleted).toBe(1);
    expect(res.body.totalRounds).toBe(2);
    expect(res.body.totalWins).toBe(1);
    expect(res.body.winRate).toBe(50);
    expect(res.body.totalKills).toBe(6);
    expect(res.body.avgAccuracy).toBe(50); // 5 hits / 10 shots
  });

  test("requires authentication (401)", async () => {
    const res = await request(app).get("/api/solo/stats/me");
    expect(res.status).toBe(401);
  });
});
