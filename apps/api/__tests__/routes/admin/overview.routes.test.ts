import request from "supertest";
import { buildApp } from "../../helpers/app";
import {
  cleanDb,
  createUserWithSession,
  createAdminWithSession,
  createLevel,
  createRound,
} from "../../helpers/db";

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
