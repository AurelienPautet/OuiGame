import request from "supertest";
import { buildApp } from "../../helpers/app";
import {
  cleanDb,
  createUserWithSession,
  createAdminWithSession,
  createLevel,
  createRound,
  createSoloRound,
  createPlaySession,
  db,
  tables,
} from "../../helpers/db";
import { upsertVisitor } from "../../../repositories/dailyActivity.repo";

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
});

describe("GET /api/admin/overview", () => {
  test("an admin gets 200 with the AdminOverview shape and non-zero totals", async () => {
    const { player, authHeader } = await createAdminWithSession();
    const level = await createLevel(player.id, { name: "OverviewLvl" });
    // Seed a round so games/combat totals are > 0.
    await createRound(player.id, level.id, { kills: 3, wins: 1 });
    // Seed one of each playtime source.
    await createSoloRound(player.id, level.id, { timeMs: 5000 });
    await createRound(player.id, level.id, { durationMs: 3000 });
    await createPlaySession(player.id, { durationMs: 7000 });

    const res = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);

    // Spot-check a few nested groups are present and numeric.
    expect(typeof res.body.players.total).toBe("number");
    expect(res.body.players.total).toBeGreaterThan(0);
    expect(typeof res.body.players.admins).toBe("number");
    expect(typeof res.body.content.levels).toBe("number");
    expect(res.body.content.levels).toBeGreaterThan(0);
    expect(typeof res.body.games.total).toBe("number");
    expect(res.body.games.onlineRounds).toBeGreaterThan(0);
    expect(typeof res.body.combat.kills).toBe("number");
    expect(res.body.combat.kills).toBe(3);
    expect(res.body.combat.wins).toBe(1);
    expect(typeof res.body.combat.accuracy).toBe("number");
    expect(typeof res.body.solo.completionRate).toBe("number");
    expect(typeof res.body.campaignsStats.completionRate).toBe("number");
    expect(typeof res.body.achievements.unlocked).toBe("number");
    expect(typeof res.body.logins.successRate).toBe("number");
    // Playtime: solo + online level time, and total connected time.
    expect(res.body.playtime).toEqual({
      soloMs: 5000,
      onlineMs: 3000,
      sessionMs: 7000,
      totalMs: 8000,
    });
    expect(typeof res.body.generatedAt).toBe("string");
  });

  test("a non-admin session gets 403", async () => {
    const { authHeader } = await createUserWithSession();

    const res = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", authHeader);

    expect(res.status).toBe(403);
  });

  test("no token gets 401", async () => {
    const res = await request(app).get("/api/admin/overview");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/timeseries", () => {
  test("returns a contiguous array of the requested length with the right keys", async () => {
    const { authHeader } = await createAdminWithSession();

    const res = await request(app)
      .get("/api/admin/timeseries")
      .query({ days: 7 })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(7);

    const point = res.body[0];
    expect(typeof point.date).toBe("string");
    expect(typeof point.newUsers).toBe("number");
    expect(typeof point.activeUsers).toBe("number");
    expect(typeof point.logins).toBe("number");
    expect(typeof point.failedLogins).toBe("number");
    expect(typeof point.onlineRounds).toBe("number");
    expect(typeof point.soloRounds).toBe("number");
    expect(typeof point.campaignRuns).toBe("number");
    expect(typeof point.games).toBe("number");
    expect(typeof point.kills).toBe("number");
    expect(typeof point.levelsCreated).toBe("number");

    // Oldest first, last point is today (UTC).
    const today = new Date().toISOString().slice(0, 10);
    expect(res.body[res.body.length - 1].date).toBe(today);
  });

  test("returns 24 hourly buckets when range=24h is given", async () => {
    const { authHeader } = await createAdminWithSession();

    const res = await request(app)
      .get("/api/admin/timeseries")
      .query({ range: "24h" })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(24);

    const point = res.body[0];
    expect(typeof point.date).toBe("string");
    expect(point.date).toMatch(/^\d{2}:00$/);
    expect(typeof point.newUsers).toBe("number");
    expect(typeof point.activeUsers).toBe("number");
    expect(typeof point.logins).toBe("number");
    expect(typeof point.failedLogins).toBe("number");
    expect(typeof point.onlineRounds).toBe("number");
    expect(typeof point.soloRounds).toBe("number");
    expect(typeof point.campaignRuns).toBe("number");
    expect(typeof point.games).toBe("number");
    expect(typeof point.kills).toBe("number");
    expect(typeof point.levelsCreated).toBe("number");
  });

  test("preserves legacy registered activity when a day has partial guest visitor data", async () => {
    const { player, authHeader } = await createAdminWithSession();
    // Seed a successful login today so activeUsersByDay has a legacy active player
    await db.insert(tables.logings).values({
      playerId: player.id,
      ipAddress: "127.0.0.1",
      status: "success",
    });

    const today = new Date().toISOString().slice(0, 10);
    // Add only a guest visitor row for today in daily_active_users
    await upsertVisitor({
      day: today,
      visitorKey: "c:test_guest_partial",
      playerId: null,
    });

    const res = await request(app)
      .get("/api/admin/timeseries")
      .query({ days: 1 })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    const point = res.body[0];
    expect(point.date).toBe(today);
    expect(point.activeGuests).toBe(1);
    expect(point.activeRegistered).toBeGreaterThanOrEqual(1);
    expect(point.activeUsers).toBe(point.activeGuests + point.activeRegistered);
  });

  test("defaults to 30 days when no query is given", async () => {
    const { authHeader } = await createAdminWithSession();

    const res = await request(app)
      .get("/api/admin/timeseries")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(30);
  });

  test("a non-admin session gets 403", async () => {
    const { authHeader } = await createUserWithSession();

    const res = await request(app)
      .get("/api/admin/timeseries")
      .set("Authorization", authHeader);

    expect(res.status).toBe(403);
  });

  test("no token gets 401", async () => {
    const res = await request(app).get("/api/admin/timeseries");
    expect(res.status).toBe(401);
  });
});
