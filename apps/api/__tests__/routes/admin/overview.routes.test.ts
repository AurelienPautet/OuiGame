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
import {
  AdminOverviewSchema,
  AdminConnectedPlayersResponseSchema,
} from "@ouigame/shared/api";
import {
  __setTrackedSocketsForTest,
  __resetForTests,
  setConnectedRoomsRef,
} from "../../../socket/connectedPlayers";
import { users } from "../../../shared_state";

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
  __resetForTests();
  for (const key of Object.keys(users)) {
    delete users[key];
  }
});

afterEach(() => {
  __resetForTests();
  for (const key of Object.keys(users)) {
    delete users[key];
  }
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

    const parsed = AdminOverviewSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    // Spot-check a few nested groups are present and numeric.
    expect(typeof res.body.players.total).toBe("number");
    expect(res.body.players.total).toBeGreaterThan(0);
    expect(typeof res.body.players.admins).toBe("number");
    expect(res.body.players.connected).toEqual({
      total: 0,
      registered: 0,
      guests: 0,
    });
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

describe("GET /api/admin/connected-players", () => {
  test("returns connected players with registered and guest details", async () => {
    const { player, authHeader } = await createAdminWithSession();

    const now = Date.now();
    __setTrackedSocketsForTest([
      {
        socketId: "sock-registered",
        clientId: "client-reg-1",
        connectedAt: now - 60000,
        ip: "192.168.1.10",
      },
      {
        socketId: "sock-guest",
        clientId: "client-guest-2",
        connectedAt: now - 30000,
        ip: "192.168.1.20",
        guestName: "SpeedyTank",
      },
    ]);

    users["sock-registered"] = {
      playerId: player.id,
      username: player.username,
      email: player.email,
    };

    setConnectedRoomsRef({
      1: {
        id: 1,
        name: "Battle Arena",
        mode: "ffa",
        status: "playing",
        players: {
          "sock-registered": { name: player.username },
        },
      },
    });

    const res = await request(app)
      .get("/api/admin/connected-players")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    const parsed = AdminConnectedPlayersResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    expect(res.body.total).toBe(2);
    expect(res.body.registeredCount).toBe(1);
    expect(res.body.guestCount).toBe(1);

    const reg = res.body.players.find(
      (p: any) => p.socketId === "sock-registered"
    );
    expect(reg).toBeDefined();
    expect(reg.type).toBe("registered");
    expect(reg.user).toEqual({
      id: player.id,
      username: player.username,
      email: player.email,
    });
    expect(reg.status).toBe("playing");
    expect(reg.room).toEqual({
      id: 1,
      name: "Battle Arena",
      mode: "ffa",
      status: "playing",
    });
    expect(reg.ip).toBe("192.168.1.10");

    const guest = res.body.players.find(
      (p: any) => p.socketId === "sock-guest"
    );
    expect(guest).toBeDefined();
    expect(guest.type).toBe("guest");
    expect(guest.user).toBeNull();
    expect(guest.guestName).toBe("SpeedyTank");
    expect(guest.status).toBe("lobby");
    expect(guest.room).toBeNull();
    expect(guest.ip).toBe("192.168.1.20");
  });

  test("filters connected players by type (registered or guest)", async () => {
    const { player, authHeader } = await createAdminWithSession();

    __setTrackedSocketsForTest([
      {
        socketId: "sock-1",
        clientId: "client-1",
        connectedAt: Date.now() - 5000,
        ip: "10.0.0.1",
      },
      {
        socketId: "sock-2",
        clientId: "client-2",
        connectedAt: Date.now() - 1000,
        ip: "10.0.0.2",
        guestName: "Guesty",
      },
    ]);

    users["sock-1"] = {
      playerId: player.id,
      username: player.username,
      email: player.email,
    };

    const resReg = await request(app)
      .get("/api/admin/connected-players")
      .query({ type: "registered" })
      .set("Authorization", authHeader);

    expect(resReg.status).toBe(200);
    expect(resReg.body.players).toHaveLength(1);
    expect(resReg.body.players[0].socketId).toBe("sock-1");

    const resGuest = await request(app)
      .get("/api/admin/connected-players")
      .query({ type: "guest" })
      .set("Authorization", authHeader);

    expect(resGuest.status).toBe(200);
    expect(resGuest.body.players).toHaveLength(1);
    expect(resGuest.body.players[0].socketId).toBe("sock-2");
  });

  test("searches connected players by name, email, client ID or IP", async () => {
    const { player, authHeader } = await createAdminWithSession();

    __setTrackedSocketsForTest([
      {
        socketId: "s-1",
        clientId: "custom-client-xyz",
        connectedAt: Date.now(),
        ip: "10.50.60.70",
      },
      {
        socketId: "s-2",
        clientId: "other-client",
        connectedAt: Date.now(),
        ip: "192.168.1.99",
        guestName: "TankCommander",
      },
    ]);

    users["s-1"] = {
      playerId: player.id,
      username: player.username,
      email: player.email,
    };

    const resSearch = await request(app)
      .get("/api/admin/connected-players")
      .query({ search: "custom-client" })
      .set("Authorization", authHeader);

    expect(resSearch.status).toBe(200);
    expect(resSearch.body.players).toHaveLength(1);
    expect(resSearch.body.players[0].socketId).toBe("s-1");

    const resSearchGuest = await request(app)
      .get("/api/admin/connected-players")
      .query({ search: "TankCommander" })
      .set("Authorization", authHeader);

    expect(resSearchGuest.status).toBe(200);
    expect(resSearchGuest.body.players).toHaveLength(1);
    expect(resSearchGuest.body.players[0].socketId).toBe("s-2");
  });

  test("returns 403 for non-admin and 401 for unauthenticated", async () => {
    const { authHeader } = await createUserWithSession();

    const res403 = await request(app)
      .get("/api/admin/connected-players")
      .set("Authorization", authHeader);
    expect(res403.status).toBe(403);

    const res401 = await request(app).get("/api/admin/connected-players");
    expect(res401.status).toBe(401);
  });
});
