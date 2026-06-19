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
  createCampaignRun,
} from "../../helpers/db";
import { eq } from "drizzle-orm";

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
});

// Seed a rating row directly (createLevel does not cover ratings).
async function seedRating(levelId: number, playerId: number, stars: number) {
  const [row] = await db
    .insert(schema.ratings)
    .values({ levelId, playerId, stars })
    .returning();
  return row;
}

describe("GET /api/admin/levels", () => {
  test("lists levels with creator name, play count and rating aggregates", async () => {
    const admin = await createAdminWithSession({
      username: "boss",
      email: "boss@example.com",
    });
    const creator = await createPlayer({
      username: "mapmaker",
      email: "mapmaker@example.com",
    });
    const level = await createLevel(creator.id, {
      name: "PopularMap",
      type: "online",
    });

    // 2 online rounds + 1 solo round => plays = 3.
    await createRound(creator.id, level.id);
    await createRound(creator.id, level.id);
    await createSoloRound(creator.id, level.id);

    // Two ratings (4 and 2) => avg 3, count 2.
    await seedRating(level.id, creator.id, 4);
    await seedRating(level.id, admin.player.id, 2);

    const res = await request(app)
      .get("/api/admin/levels")
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.levels).toHaveLength(1);
    const row = res.body.levels[0];
    expect(row.id).toBe(level.id);
    expect(row.name).toBe("PopularMap");
    expect(row.creatorName).toBe("mapmaker");
    expect(row.plays).toBe(3);
    expect(row.rating).toBe(3);
    expect(row.ratingCount).toBe(2);
    expect(typeof row.createdAt).toBe("string");
  });

  test("a level with no plays/ratings reports plays 0 and rating null", async () => {
    const admin = await createAdminWithSession({
      username: "boss2",
      email: "boss2@example.com",
    });
    const creator = await createPlayer({
      username: "c2",
      email: "c2@example.com",
    });
    await createLevel(creator.id, { name: "QuietMap" });

    const res = await request(app)
      .get("/api/admin/levels")
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const row = res.body.levels[0];
    expect(row.plays).toBe(0);
    expect(row.rating).toBeNull();
    expect(row.ratingCount).toBe(0);
  });

  test("status filter returns only matching levels", async () => {
    const admin = await createAdminWithSession({
      username: "boss3",
      email: "boss3@example.com",
    });
    const creator = await createPlayer({
      username: "c3",
      email: "c3@example.com",
    });
    await createLevel(creator.id, { name: "UpMap", status: "up" });
    await createLevel(creator.id, { name: "DownMap", status: "down" });

    const res = await request(app)
      .get("/api/admin/levels")
      .query({ status: "down" })
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.levels).toHaveLength(1);
    expect(res.body.levels[0].name).toBe("DownMap");
    expect(res.body.levels[0].status).toBe("down");
  });

  test("search filters by name substring", async () => {
    const admin = await createAdminWithSession({
      username: "boss4",
      email: "boss4@example.com",
    });
    const creator = await createPlayer({
      username: "c4",
      email: "c4@example.com",
    });
    await createLevel(creator.id, { name: "Castle" });
    await createLevel(creator.id, { name: "Desert" });

    const res = await request(app)
      .get("/api/admin/levels")
      .query({ search: "Cast" })
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.levels[0].name).toBe("Castle");
  });

  test("paginates: total counts all matches, page returns the slice", async () => {
    const admin = await createAdminWithSession({
      username: "boss5",
      email: "boss5@example.com",
    });
    const creator = await createPlayer({
      username: "c5",
      email: "c5@example.com",
    });
    for (let i = 0; i < 5; i += 1) {
      await createLevel(creator.id, { name: `Map${i}` });
    }

    const res = await request(app)
      .get("/api/admin/levels")
      .query({ page: 1, pageSize: 2 })
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(2);
    expect(res.body.levels).toHaveLength(2);
  });

  test("rejects a non-admin (403)", async () => {
    const { authHeader } = await createUserWithSession({
      username: "plain",
      email: "plain@example.com",
    });
    const res = await request(app)
      .get("/api/admin/levels")
      .set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  test("rejects an unauthenticated request (401)", async () => {
    const res = await request(app).get("/api/admin/levels");
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/admin/levels/:id", () => {
  test("toggles the level status and writes an audit row", async () => {
    const admin = await createAdminWithSession({
      username: "boss6",
      email: "boss6@example.com",
    });
    const creator = await createPlayer({
      username: "c6",
      email: "c6@example.com",
    });
    const level = await createLevel(creator.id, {
      name: "ToTakeDown",
      status: "up",
    });

    const res = await request(app)
      .patch(`/api/admin/levels/${level.id}`)
      .set("Authorization", admin.authHeader)
      .send({ status: "down" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rows = await db
      .select()
      .from(schema.levels)
      .where(eq(schema.levels.id, level.id));
    expect(rows[0].status).toBe("down");

    const audit = await db
      .select()
      .from(schema.adminAuditLog)
      .where(eq(schema.adminAuditLog.action, "level.update_status"));
    expect(audit).toHaveLength(1);
    expect(audit[0].actorId).toBe(admin.player.id);
    expect(audit[0].targetType).toBe("level");
    expect(audit[0].targetId).toBe(level.id);
    expect(audit[0].details).toEqual({ status: "down" });
  });

  test("returns 404 for a missing level", async () => {
    const { authHeader } = await createAdminWithSession({
      username: "boss7",
      email: "boss7@example.com",
    });
    const res = await request(app)
      .patch("/api/admin/levels/999999")
      .set("Authorization", authHeader)
      .send({ status: "down" });
    expect(res.status).toBe(404);
  });

  test("rejects a non-admin (403)", async () => {
    const { authHeader } = await createUserWithSession({
      username: "plain3",
      email: "plain3@example.com",
    });
    const res = await request(app)
      .patch("/api/admin/levels/1")
      .set("Authorization", authHeader)
      .send({ status: "down" });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/admin/levels/:id", () => {
  test("deletes the level (children cascade) and writes an audit row", async () => {
    const admin = await createAdminWithSession({
      username: "boss8",
      email: "boss8@example.com",
    });
    const creator = await createPlayer({
      username: "c8",
      email: "c8@example.com",
    });
    const level = await createLevel(creator.id, {
      name: "ToDelete",
      img: "aa",
    });
    await createRound(creator.id, level.id);
    await createSoloRound(creator.id, level.id);

    const res = await request(app)
      .delete(`/api/admin/levels/${level.id}`)
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(
      await db
        .select()
        .from(schema.levels)
        .where(eq(schema.levels.id, level.id))
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.rounds)
        .where(eq(schema.rounds.levelId, level.id))
    ).toHaveLength(0);

    const audit = await db
      .select()
      .from(schema.adminAuditLog)
      .where(eq(schema.adminAuditLog.action, "level.delete"));
    expect(audit).toHaveLength(1);
    expect(audit[0].targetType).toBe("level");
    expect(audit[0].targetId).toBe(level.id);
    expect(audit[0].details).toEqual({ name: "ToDelete" });
  });

  test("returns 404 for a missing level", async () => {
    const { authHeader } = await createAdminWithSession({
      username: "boss9",
      email: "boss9@example.com",
    });
    const res = await request(app)
      .delete("/api/admin/levels/999999")
      .set("Authorization", authHeader);
    expect(res.status).toBe(404);
  });

  test("rejects a non-admin (403)", async () => {
    const { authHeader } = await createUserWithSession({
      username: "plain4",
      email: "plain4@example.com",
    });
    const res = await request(app)
      .delete("/api/admin/levels/1")
      .set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/admin/campaigns", () => {
  test("lists campaigns with creator name, level/run/completion counts", async () => {
    const admin = await createAdminWithSession({
      username: "cboss",
      email: "cboss@example.com",
    });
    const creator = await createPlayer({
      username: "cmaker",
      email: "cmaker@example.com",
    });
    const l1 = await createLevel(creator.id, { name: "CL1", type: "solo" });
    const l2 = await createLevel(creator.id, { name: "CL2", type: "solo" });
    const campaign = await createCampaign(creator.id, [l1.id, l2.id], {
      name: "Saga",
    });

    // Three runs, one of them completed.
    await createCampaignRun(creator.id, campaign.id, { completed: false });
    await createCampaignRun(creator.id, campaign.id, { completed: true });
    await createCampaignRun(creator.id, campaign.id, { completed: false });

    const res = await request(app)
      .get("/api/admin/campaigns")
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.campaigns).toHaveLength(1);
    const row = res.body.campaigns[0];
    expect(row.id).toBe(campaign.id);
    expect(row.name).toBe("Saga");
    expect(row.creatorName).toBe("cmaker");
    expect(row.levelCount).toBe(2);
    expect(row.runs).toBe(3);
    expect(row.completions).toBe(1);
    expect(typeof row.createdAt).toBe("string");
  });

  test("search filters by name substring", async () => {
    const admin = await createAdminWithSession({
      username: "cboss2",
      email: "cboss2@example.com",
    });
    const creator = await createPlayer({
      username: "cmaker2",
      email: "cmaker2@example.com",
    });
    await createCampaign(creator.id, [], { name: "Alpha" });
    await createCampaign(creator.id, [], { name: "Beta" });

    const res = await request(app)
      .get("/api/admin/campaigns")
      .query({ search: "Alph" })
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.campaigns[0].name).toBe("Alpha");
  });

  test("rejects a non-admin (403)", async () => {
    const { authHeader } = await createUserWithSession({
      username: "plain5",
      email: "plain5@example.com",
    });
    const res = await request(app)
      .get("/api/admin/campaigns")
      .set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });

  test("rejects an unauthenticated request (401)", async () => {
    const res = await request(app).get("/api/admin/campaigns");
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/admin/campaigns/:id", () => {
  test("deletes the campaign (runs + links cascade) and writes an audit row", async () => {
    const admin = await createAdminWithSession({
      username: "cboss3",
      email: "cboss3@example.com",
    });
    const creator = await createPlayer({
      username: "cmaker3",
      email: "cmaker3@example.com",
    });
    const level = await createLevel(creator.id, { name: "CLvl", type: "solo" });
    const campaign = await createCampaign(creator.id, [level.id], {
      name: "Doomed",
    });
    await createCampaignRun(creator.id, campaign.id, { completed: true });

    const res = await request(app)
      .delete(`/api/admin/campaigns/${campaign.id}`)
      .set("Authorization", admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(
      await db
        .select()
        .from(schema.campaigns)
        .where(eq(schema.campaigns.id, campaign.id))
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.campaignLevels)
        .where(eq(schema.campaignLevels.campaignId, campaign.id))
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.campaignRuns)
        .where(eq(schema.campaignRuns.campaignId, campaign.id))
    ).toHaveLength(0);

    const audit = await db
      .select()
      .from(schema.adminAuditLog)
      .where(eq(schema.adminAuditLog.action, "campaign.delete"));
    expect(audit).toHaveLength(1);
    expect(audit[0].targetType).toBe("campaign");
    expect(audit[0].targetId).toBe(campaign.id);
    expect(audit[0].details).toEqual({ name: "Doomed" });
  });

  test("returns 404 for a missing campaign", async () => {
    const { authHeader } = await createAdminWithSession({
      username: "cboss4",
      email: "cboss4@example.com",
    });
    const res = await request(app)
      .delete("/api/admin/campaigns/999999")
      .set("Authorization", authHeader);
    expect(res.status).toBe(404);
  });

  test("rejects a non-admin (403)", async () => {
    const { authHeader } = await createUserWithSession({
      username: "plain6",
      email: "plain6@example.com",
    });
    const res = await request(app)
      .delete("/api/admin/campaigns/1")
      .set("Authorization", authHeader);
    expect(res.status).toBe(403);
  });
});
