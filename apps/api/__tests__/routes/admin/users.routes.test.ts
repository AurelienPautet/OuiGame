import request from "supertest";
import { buildApp } from "../../helpers/app";
import {
  db,
  schema,
  cleanDb,
  createPlayer,
  createUserWithSession,
  createAdminWithSession,
  createLevel,
  createRound,
  createSoloRound,
  createCampaign,
} from "../../helpers/db";
import { eq } from "drizzle-orm";

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
});

describe("GET /api/admin/users", () => {
  test("lists all users with numeric aggregates", async () => {
    const admin = await createAdminWithSession({
      username: "boss",
      email: "boss@example.com",
    });
    const user = await createPlayer({
      username: "player1",
      email: "player1@example.com",
    });

    // Give the user some activity: one online round (2 kills, 1 win), one solo
    // round (3 kills), and one created level.
    const level = await createLevel(user.id, { name: "UserLevel" });
    await createRound(user.id, level.id, { kills: 2, wins: 1 });
    await createSoloRound(user.id, level.id, { kills: 3 });

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.users).toHaveLength(2);

    const row = res.body.users.find((u) => u.username === "player1");
    expect(row).toBeDefined();
    expect(row.id).toBe(user.id);
    expect(row.email).toBe("player1@example.com");
    expect(row.type).toBe("db");
    expect(row.isAdmin).toBe(false);
    expect(typeof row.createdAt).toBe("string");
    expect(row.onlineRounds).toBe(1);
    expect(row.soloRounds).toBe(1);
    // kills = rounds.kills (2) + soloRounds.kills (3) = 5.
    expect(row.kills).toBe(5);
    expect(row.wins).toBe(1);
    expect(row.levelsCreated).toBe(1);
    expect(row.campaignsCreated).toBe(0);
    expect(row.achievements).toBe(0);
    // Every numeric aggregate is a plain number, not a string.
    expect(typeof row.kills).toBe("number");
    expect(typeof row.onlineRounds).toBe("number");
  });

  test("search filters by username OR email (case-insensitive substring)", async () => {
    const admin = await createAdminWithSession({
      username: "boss2",
      email: "boss2@example.com",
    });
    await createPlayer({ username: "alice", email: "alice@example.com" });
    await createPlayer({ username: "bob", email: "bob@somewhere.com" });

    const byName = await request(app)
      .get("/api/admin/users")
      .query({ search: "ALIC" })
      .set("Authorization", admin.authHeader);
    expect(byName.status).toBe(200);
    expect(byName.body.total).toBe(1);
    expect(byName.body.users[0].username).toBe("alice");

    const byEmail = await request(app)
      .get("/api/admin/users")
      .query({ search: "somewhere" })
      .set("Authorization", admin.authHeader);
    expect(byEmail.body.total).toBe(1);
    expect(byEmail.body.users[0].username).toBe("bob");
  });

  test("paginates: total counts all matching users, page returns the slice", async () => {
    const admin = await createAdminWithSession({
      username: "boss3",
      email: "boss3@example.com",
    });
    await createPlayer({ username: "u1", email: "u1@example.com" });
    await createPlayer({ username: "u2", email: "u2@example.com" });

    const res = await request(app)
      .get("/api/admin/users")
      .query({ pageSize: 1 })
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    // Three users total (the admin + the two created), only one per page.
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.users).toHaveLength(1);
  });

  test("sorts by kills descending across all matching users", async () => {
    const admin = await createAdminWithSession({
      username: "boss4",
      email: "boss4@example.com",
    });
    const low = await createPlayer({ username: "low", email: "low@x.com" });
    const high = await createPlayer({ username: "high", email: "high@x.com" });
    const level = await createLevel(admin.player.id, { name: "SortLevel" });
    await createRound(low.id, level.id, { kills: 1 });
    await createRound(high.id, level.id, { kills: 99 });

    const res = await request(app)
      .get("/api/admin/users")
      .query({ sort: "kills", order: "desc" })
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    // "high" (99 kills) must lead "low" (1 kill).
    const usernames = res.body.users.map((u) => u.username);
    expect(usernames.indexOf("high")).toBeLessThan(usernames.indexOf("low"));
  });

  test("rejects a non-admin (403)", async () => {
    const { authHeader } = await createUserWithSession({
      username: "plain",
      email: "plain@example.com",
    });
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  test("rejects an unauthenticated request (401)", async () => {
    const res = await request(app).get("/api/admin/users");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/users/:id", () => {
  test("returns a user's full detail with recentLogins and levels arrays", async () => {
    const admin = await createAdminWithSession({
      username: "boss5",
      email: "boss5@example.com",
    });
    const user = await createPlayer({
      username: "detailed",
      email: "detailed@example.com",
    });

    const level = await createLevel(user.id, { name: "DetailLevel" });
    await createRound(user.id, level.id, {
      kills: 4,
      deaths: 2,
      shots: 10,
      hits: 5,
      blocksDestroyed: 3,
    });
    await createSoloRound(user.id, level.id, { success: true, kills: 1 });
    await createCampaign(user.id, [level.id], { name: "DetailCampaign" });
    await db.insert(schema.logings).values({
      playerId: user.id,
      ipAddress: "10.0.0.5",
      status: "login_success",
    });

    const res = await request(app)
      .get(`/api/admin/users/${user.id}`)
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.username).toBe("detailed");
    expect(res.body.deaths).toBe(2);
    expect(res.body.shots).toBe(10);
    expect(res.body.hits).toBe(5);
    expect(res.body.accuracy).toBeCloseTo(0.5);
    expect(res.body.blocksDestroyed).toBe(3);
    expect(res.body.soloCompletions).toBe(1);
    expect(res.body.campaignRuns).toBe(0);

    expect(Array.isArray(res.body.recentLogins)).toBe(true);
    expect(res.body.recentLogins).toHaveLength(1);
    expect(res.body.recentLogins[0].ip).toBe("10.0.0.5");
    expect(res.body.recentLogins[0].status).toBe("login_success");

    expect(Array.isArray(res.body.levels)).toBe(true);
    expect(res.body.levels.map((l) => l.name)).toContain("DetailLevel");

    expect(Array.isArray(res.body.campaigns)).toBe(true);
    expect(res.body.campaigns.map((c) => c.name)).toContain("DetailCampaign");

    expect(Array.isArray(res.body.achievements)).toBe(true);
  });

  test("returns 404 for a missing user", async () => {
    const admin = await createAdminWithSession({
      username: "boss6",
      email: "boss6@example.com",
    });
    const res = await request(app)
      .get("/api/admin/users/999999")
      .set("Authorization", admin.authHeader);
    expect(res.status).toBe(404);
  });

  test("rejects a non-admin (403)", async () => {
    const { player, authHeader } = await createUserWithSession({
      username: "plain3",
      email: "plain3@example.com",
    });
    const res = await request(app)
      .get(`/api/admin/users/${player.id}`)
      .set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  test("rejects an unauthenticated request (401)", async () => {
    const res = await request(app).get("/api/admin/users/1");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/admin/users/:id", () => {
  test("promotes a normal user to admin, then demotes", async () => {
    const admin = await createAdminWithSession({
      username: "boss7",
      email: "boss7@example.com",
    });
    const user = await createPlayer({
      username: "promoteme",
      email: "promoteme@example.com",
    });

    const promote = await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set("Authorization", admin.authHeader)
      .send({ isAdmin: true });
    expect(promote.status).toBe(200);
    expect(promote.body.isAdmin).toBe(true);

    const afterPromote = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, user.id));
    expect(afterPromote[0].isAdmin).toBe(true);

    const demote = await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set("Authorization", admin.authHeader)
      .send({ isAdmin: false });
    expect(demote.status).toBe(200);
    expect(demote.body.isAdmin).toBe(false);

    const afterDemote = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, user.id));
    expect(afterDemote[0].isAdmin).toBe(false);
  });

  test("records an audit row on promotion", async () => {
    const admin = await createAdminWithSession({
      username: "boss8",
      email: "boss8@example.com",
    });
    const user = await createPlayer({
      username: "audited",
      email: "audited@example.com",
    });

    await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set("Authorization", admin.authHeader)
      .send({ isAdmin: true });

    const rows = await db
      .select()
      .from(schema.adminAuditLog)
      .where(eq(schema.adminAuditLog.action, "user.update_admin"));
    expect(rows).toHaveLength(1);
    expect(rows[0].actorId).toBe(admin.player.id);
    expect(rows[0].targetType).toBe("user");
    expect(rows[0].targetId).toBe(user.id);
    expect(rows[0].details).toEqual({ isAdmin: true });
  });

  test("refuses to change your own admin status (400)", async () => {
    const admin = await createAdminWithSession({
      username: "boss9",
      email: "boss9@example.com",
    });
    const res = await request(app)
      .patch(`/api/admin/users/${admin.player.id}`)
      .set("Authorization", admin.authHeader)
      .send({ isAdmin: false });
    expect(res.status).toBe(400);
  });

  test("returns 404 for a missing user", async () => {
    const admin = await createAdminWithSession({
      username: "boss10",
      email: "boss10@example.com",
    });
    const res = await request(app)
      .patch("/api/admin/users/999999")
      .set("Authorization", admin.authHeader)
      .send({ isAdmin: true });
    expect(res.status).toBe(404);
  });

  test("rejects a non-admin (403)", async () => {
    const { player, authHeader } = await createUserWithSession({
      username: "plain4",
      email: "plain4@example.com",
    });
    const res = await request(app)
      .patch(`/api/admin/users/${player.id}`)
      .set("Authorization", authHeader)
      .send({ isAdmin: true });
    expect(res.status).toBe(403);
  });

  test("rejects an unauthenticated request (401)", async () => {
    const res = await request(app)
      .patch("/api/admin/users/1")
      .send({ isAdmin: true });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  test("removes a user and records an audit row", async () => {
    const admin = await createAdminWithSession({
      username: "boss11",
      email: "boss11@example.com",
    });
    const user = await createPlayer({
      username: "deleteme",
      email: "deleteme@example.com",
    });

    const res = await request(app)
      .delete(`/api/admin/users/${user.id}`)
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rows = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, user.id));
    expect(rows).toHaveLength(0);

    const audit = await db
      .select()
      .from(schema.adminAuditLog)
      .where(eq(schema.adminAuditLog.action, "user.delete"));
    expect(audit).toHaveLength(1);
    expect(audit[0].actorId).toBe(admin.player.id);
    expect(audit[0].targetType).toBe("user");
    expect(audit[0].targetId).toBe(user.id);
    expect(audit[0].details).toEqual({ username: "deleteme" });
  });

  test("refuses to delete your own account (400)", async () => {
    const admin = await createAdminWithSession({
      username: "boss12",
      email: "boss12@example.com",
    });
    const res = await request(app)
      .delete(`/api/admin/users/${admin.player.id}`)
      .set("Authorization", admin.authHeader);
    expect(res.status).toBe(400);

    // The account is still there.
    const rows = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, admin.player.id));
    expect(rows).toHaveLength(1);
  });

  test("returns 404 for a missing user", async () => {
    const admin = await createAdminWithSession({
      username: "boss13",
      email: "boss13@example.com",
    });
    const res = await request(app)
      .delete("/api/admin/users/999999")
      .set("Authorization", admin.authHeader);
    expect(res.status).toBe(404);
  });

  test("rejects a non-admin (403)", async () => {
    const { player, authHeader } = await createUserWithSession({
      username: "plain5",
      email: "plain5@example.com",
    });
    const res = await request(app)
      .delete(`/api/admin/users/${player.id}`)
      .set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  test("rejects an unauthenticated request (401)", async () => {
    const res = await request(app).delete("/api/admin/users/1");
    expect(res.status).toBe(401);
  });
});
