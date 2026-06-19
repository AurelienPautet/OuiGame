import request from "supertest";
import { buildApp } from "../../helpers/app";
import {
  db,
  schema,
  cleanDb,
  createPlayer,
  createUserWithSession,
  createAdminWithSession,
} from "../../helpers/db";

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
});

// Seed a login attempt row directly. attemptTimestamp is left to defaultNow().
async function seedLogin(
  playerId: number,
  overrides: { ip?: string; status?: string } = {}
) {
  const [row] = await db
    .insert(schema.logings)
    .values({
      playerId,
      ipAddress: overrides.ip ?? "127.0.0.1",
      status: overrides.status ?? "success",
    })
    .returning();
  return row;
}

// Seed an admin audit row directly. timestamp is left to defaultNow().
async function seedAudit(
  actorId: number,
  overrides: {
    action?: string;
    targetType?: string | null;
    targetId?: number | null;
    details?: unknown;
  } = {}
) {
  const [row] = await db
    .insert(schema.adminAuditLog)
    .values({
      actorId,
      action: overrides.action ?? "promote_user",
      targetType: overrides.targetType ?? "player",
      targetId: overrides.targetId ?? null,
      details: overrides.details ?? { foo: "bar" },
    })
    .returning();
  return row;
}

describe("GET /api/admin/logins", () => {
  test("lists login attempts newest first with the username resolved", async () => {
    const { authHeader } = await createAdminWithSession({
      username: "boss",
      email: "boss@example.com",
    });
    const player = await createPlayer({
      username: "loginuser",
      email: "loginuser@example.com",
    });

    await seedLogin(player.id, { ip: "1.1.1.1", status: "success" });
    await seedLogin(player.id, { ip: "2.2.2.2", status: "failed" });

    const res = await request(app)
      .get("/api/admin/logins")
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.logins).toHaveLength(2);
    // Newest first: the failed attempt (inserted last) leads.
    expect(res.body.logins[0].status).toBe("failed");
    expect(res.body.logins[0].ip).toBe("2.2.2.2");
    expect(res.body.logins[0].username).toBe("loginuser");
    expect(typeof res.body.logins[0].at).toBe("string");
  });

  test("status filter returns only matching attempts (substring, case-insensitive)", async () => {
    const { authHeader } = await createAdminWithSession({
      username: "boss2",
      email: "boss2@example.com",
    });
    const player = await createPlayer({
      username: "u2",
      email: "u2@example.com",
    });

    await seedLogin(player.id, { status: "success" });
    await seedLogin(player.id, { status: "failed" });
    await seedLogin(player.id, { status: "failed" });

    const res = await request(app)
      .get("/api/admin/logins")
      .query({ status: "fail" })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.logins).toHaveLength(2);
    expect(res.body.logins.every((l) => l.status === "failed")).toBe(true);
  });

  test("search matches username OR ip", async () => {
    const { authHeader } = await createAdminWithSession({
      username: "boss3",
      email: "boss3@example.com",
    });
    const alice = await createPlayer({
      username: "alice",
      email: "alice@example.com",
    });
    const bob = await createPlayer({
      username: "bob",
      email: "bob@example.com",
    });

    await seedLogin(alice.id, { ip: "10.0.0.1" });
    await seedLogin(bob.id, { ip: "192.168.1.1" });

    const byName = await request(app)
      .get("/api/admin/logins")
      .query({ search: "alic" })
      .set("Authorization", authHeader);
    expect(byName.body.total).toBe(1);
    expect(byName.body.logins[0].username).toBe("alice");

    const byIp = await request(app)
      .get("/api/admin/logins")
      .query({ search: "192.168" })
      .set("Authorization", authHeader);
    expect(byIp.body.total).toBe(1);
    expect(byIp.body.logins[0].ip).toBe("192.168.1.1");
  });

  test("paginates: total counts all matches, page returns the slice", async () => {
    const { authHeader } = await createAdminWithSession({
      username: "boss4",
      email: "boss4@example.com",
    });
    const player = await createPlayer({
      username: "u4",
      email: "u4@example.com",
    });

    for (let i = 0; i < 5; i += 1) {
      await seedLogin(player.id, { status: "success" });
    }

    const res = await request(app)
      .get("/api/admin/logins")
      .query({ page: 1, pageSize: 2 })
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.logins).toHaveLength(2);
  });

  test("rejects a non-admin (403)", async () => {
    const { authHeader } = await createUserWithSession({
      username: "plain",
      email: "plain@example.com",
    });
    const res = await request(app)
      .get("/api/admin/logins")
      .set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  test("rejects an unauthenticated request (401)", async () => {
    const res = await request(app).get("/api/admin/logins");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/audit", () => {
  test("lists audit entries newest first with the actor name resolved", async () => {
    const admin = await createAdminWithSession({
      username: "auditor",
      email: "auditor@example.com",
    });

    await seedAudit(admin.player.id, { action: "promote_user" });
    await seedAudit(admin.player.id, { action: "unpublish_level" });

    const res = await request(app)
      .get("/api/admin/audit")
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.entries).toHaveLength(2);
    // Newest first: the second insert leads.
    expect(res.body.entries[0].action).toBe("unpublish_level");
    expect(res.body.entries[0].actorName).toBe("auditor");
    expect(res.body.entries[0].details).toEqual({ foo: "bar" });
    expect(typeof res.body.entries[0].at).toBe("string");
  });

  test("search filters by action substring", async () => {
    const admin = await createAdminWithSession({
      username: "auditor2",
      email: "auditor2@example.com",
    });

    await seedAudit(admin.player.id, { action: "promote_user" });
    await seedAudit(admin.player.id, { action: "demote_user" });
    await seedAudit(admin.player.id, { action: "unpublish_level" });

    const res = await request(app)
      .get("/api/admin/audit")
      .query({ search: "user" })
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.entries.every((e) => e.action.includes("user"))).toBe(true);
  });

  test("paginates audit entries", async () => {
    const admin = await createAdminWithSession({
      username: "auditor3",
      email: "auditor3@example.com",
    });

    for (let i = 0; i < 4; i += 1) {
      await seedAudit(admin.player.id, { action: "promote_user" });
    }

    const res = await request(app)
      .get("/api/admin/audit")
      .query({ page: 1, pageSize: 3 })
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(3);
    expect(res.body.entries).toHaveLength(3);
  });

  test("rejects a non-admin (403)", async () => {
    const { authHeader } = await createUserWithSession({
      username: "plain2",
      email: "plain2@example.com",
    });
    const res = await request(app)
      .get("/api/admin/audit")
      .set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  test("rejects an unauthenticated request (401)", async () => {
    const res = await request(app).get("/api/admin/audit");
    expect(res.status).toBe(401);
  });
});
