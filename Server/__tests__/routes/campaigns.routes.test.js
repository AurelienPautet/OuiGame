const request = require("supertest");
const { buildApp } = require("../helpers/app");
const {
  db,
  schema,
  cleanDb,
  createUserWithSession,
  createLevel,
  createCampaign,
  createCampaignRun,
} = require("../helpers/db");
const { eq, asc } = require("drizzle-orm");

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
});

// Convenience: make N public solo levels owned by `creatorId`.
async function makeSoloLevels(creatorId, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(await createLevel(creatorId, { type: "solo", status: "up" }));
  }
  return out;
}

describe("POST /api/campaigns", () => {
  test("creates a campaign with ordered solo levels", async () => {
    const { player, authHeader } = await createUserWithSession();
    const levels = await makeSoloLevels(player.id, 3);

    const res = await request(app)
      .post("/api/campaigns")
      .set("Authorization", authHeader)
      .send({
        name: "My Campaign",
        description: "fun",
        levelIds: [levels[2].id, levels[0].id, levels[1].id],
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.campaignId).toBe("number");

    const links = await db
      .select()
      .from(schema.campaignLevels)
      .where(eq(schema.campaignLevels.campaignId, res.body.campaignId))
      .orderBy(asc(schema.campaignLevels.orderIndex));
    expect(links.map((l) => l.levelId)).toEqual([
      levels[2].id,
      levels[0].id,
      levels[1].id,
    ]);
    expect(links.map((l) => l.orderIndex)).toEqual([0, 1, 2]);
  });

  test("requires authentication (401)", async () => {
    const res = await request(app)
      .post("/api/campaigns")
      .send({ name: "x", levelIds: [1] });
    expect(res.status).toBe(401);
  });

  test("rejects a campaign with no valid levels (400)", async () => {
    const { authHeader } = await createUserWithSession();
    const res = await request(app)
      .post("/api/campaigns")
      .set("Authorization", authHeader)
      .send({ name: "empty", levelIds: [] });
    expect(res.status).toBe(400);
  });

  test("drops non-solo / non-up levels; 400 if none remain valid", async () => {
    const { player, authHeader } = await createUserWithSession();
    const online = await createLevel(player.id, { type: "online" });
    const solo = await createLevel(player.id, { type: "solo", status: "up" });

    // Only the solo level should survive filtering.
    const ok = await request(app)
      .post("/api/campaigns")
      .set("Authorization", authHeader)
      .send({ name: "mixed", levelIds: [online.id, solo.id] });
    expect(ok.status).toBe(200);
    const links = await db
      .select()
      .from(schema.campaignLevels)
      .where(eq(schema.campaignLevels.campaignId, ok.body.campaignId));
    expect(links.map((l) => l.levelId)).toEqual([solo.id]);

    // A campaign of only online levels is rejected.
    const bad = await request(app)
      .post("/api/campaigns")
      .set("Authorization", authHeader)
      .send({ name: "onlineonly", levelIds: [online.id] });
    expect(bad.status).toBe(400);
  });

  test("rejects a duplicate campaign name (409)", async () => {
    const { player, authHeader } = await createUserWithSession();
    const [lvl] = await makeSoloLevels(player.id, 1);
    await createCampaign(player.id, [lvl.id], { name: "Taken" });

    const res = await request(app)
      .post("/api/campaigns")
      .set("Authorization", authHeader)
      .send({ name: "Taken", levelIds: [lvl.id] });
    expect(res.status).toBe(409);
  });
});

describe("GET /api/campaigns", () => {
  test("lists campaigns with level count and per-user completion", async () => {
    const { player, authHeader } = await createUserWithSession();
    const levels = await makeSoloLevels(player.id, 4);
    const campaign = await createCampaign(
      player.id,
      levels.map((l) => l.id),
      { name: "Quad" }
    );
    // Best run cleared 2 of 4 levels → 50%, not completed.
    await createCampaignRun(player.id, campaign.id, {
      levelsCleared: 2,
      completed: false,
    });

    const res = await request(app)
      .get("/api/campaigns")
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);
    const row = res.body.find((c) => c.campaign_id === campaign.id);
    expect(row.level_count).toBe(4);
    expect(row.completion_percent).toBe(50);
    expect(row.completed).toBe(false);
  });

  test("marks completed when a run finished the campaign", async () => {
    const { player, authHeader } = await createUserWithSession();
    const levels = await makeSoloLevels(player.id, 2);
    const campaign = await createCampaign(
      player.id,
      levels.map((l) => l.id)
    );
    await createCampaignRun(player.id, campaign.id, {
      levelsCleared: 2,
      completed: true,
    });

    const res = await request(app)
      .get("/api/campaigns")
      .set("Authorization", authHeader);
    const row = res.body.find((c) => c.campaign_id === campaign.id);
    expect(row.completion_percent).toBe(100);
    expect(row.completed).toBe(true);
  });

  test("anonymous request sees zero completion", async () => {
    const { player } = await createUserWithSession();
    const levels = await makeSoloLevels(player.id, 2);
    const campaign = await createCampaign(
      player.id,
      levels.map((l) => l.id)
    );
    await createCampaignRun(player.id, campaign.id, {
      levelsCleared: 2,
      completed: true,
    });

    const res = await request(app).get("/api/campaigns");
    const row = res.body.find((c) => c.campaign_id === campaign.id);
    expect(row.completion_percent).toBe(0);
    expect(row.completed).toBe(false);
  });
});

describe("GET /api/campaigns/my", () => {
  test("returns only the caller's campaigns", async () => {
    const me = await createUserWithSession({ email: "me@example.com" });
    const other = await createUserWithSession({
      username: "other",
      email: "other@example.com",
    });
    const [mine] = await makeSoloLevels(me.player.id, 1);
    const [theirs] = await makeSoloLevels(other.player.id, 1);
    await createCampaign(me.player.id, [mine.id], { name: "Mine" });
    await createCampaign(other.player.id, [theirs.id], { name: "Theirs" });

    const res = await request(app)
      .get("/api/campaigns/my")
      .set("Authorization", me.authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].campaign_name).toBe("Mine");
  });

  test("requires authentication (401)", async () => {
    const res = await request(app).get("/api/campaigns/my");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/campaigns/:id", () => {
  test("returns ordered levels and rejects bad/missing ids", async () => {
    const { player } = await createUserWithSession();
    const levels = await makeSoloLevels(player.id, 3);
    const campaign = await createCampaign(
      player.id,
      levels.map((l) => l.id)
    );

    const res = await request(app).get(`/api/campaigns/${campaign.id}`);
    expect(res.status).toBe(200);
    expect(res.body.levels.map((l) => l.level_id)).toEqual(
      levels.map((l) => l.id)
    );
    expect(res.body.levels.map((l) => l.order_index)).toEqual([0, 1, 2]);

    expect((await request(app).get("/api/campaigns/abc")).status).toBe(400);
    expect((await request(app).get("/api/campaigns/999999")).status).toBe(404);
  });

  test("excludes taken-down levels from the list and the % denominator", async () => {
    const { player, authHeader } = await createUserWithSession();
    const levels = await makeSoloLevels(player.id, 3);
    const campaign = await createCampaign(
      player.id,
      levels.map((l) => l.id)
    );
    // Take one level down after it was added to the campaign.
    await db
      .update(schema.levels)
      .set({ status: "down" })
      .where(eq(schema.levels.id, levels[1].id));
    // A run cleared the 2 remaining playable levels → 100%.
    await createCampaignRun(player.id, campaign.id, {
      levelsCleared: 2,
      completed: true,
    });

    const res = await request(app)
      .get(`/api/campaigns/${campaign.id}`)
      .set("Authorization", authHeader);
    expect(res.body.levels.map((l) => l.level_id)).toEqual([
      levels[0].id,
      levels[2].id,
    ]);
    expect(res.body.level_count).toBe(2);
    expect(res.body.completion_percent).toBe(100);
  });
});

describe("PUT /api/campaigns/:id", () => {
  test("owner can rename and reorder; order_index is rewritten cleanly", async () => {
    const { player, authHeader } = await createUserWithSession();
    const levels = await makeSoloLevels(player.id, 3);
    const campaign = await createCampaign(
      player.id,
      levels.map((l) => l.id),
      { name: "Before" }
    );

    const reversed = [levels[2].id, levels[1].id, levels[0].id];
    const res = await request(app)
      .put(`/api/campaigns/${campaign.id}`)
      .set("Authorization", authHeader)
      .send({ name: "After", description: "d", levelIds: reversed });
    expect(res.status).toBe(200);

    const links = await db
      .select()
      .from(schema.campaignLevels)
      .where(eq(schema.campaignLevels.campaignId, campaign.id))
      .orderBy(asc(schema.campaignLevels.orderIndex));
    expect(links.map((l) => l.levelId)).toEqual(reversed);
    expect(links.map((l) => l.orderIndex)).toEqual([0, 1, 2]);
  });

  test("non-owner cannot update (403)", async () => {
    const owner = await createUserWithSession({ email: "owner@example.com" });
    const intruder = await createUserWithSession({
      username: "intruder",
      email: "intruder@example.com",
    });
    const [lvl] = await makeSoloLevels(owner.player.id, 1);
    const campaign = await createCampaign(owner.player.id, [lvl.id]);

    const res = await request(app)
      .put(`/api/campaigns/${campaign.id}`)
      .set("Authorization", intruder.authHeader)
      .send({ name: "hijack", levelIds: [lvl.id] });
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/campaigns/:id", () => {
  test("owner delete cascades to campaign_levels and runs", async () => {
    const { player, authHeader } = await createUserWithSession();
    const [lvl] = await makeSoloLevels(player.id, 1);
    const campaign = await createCampaign(player.id, [lvl.id]);
    await createCampaignRun(player.id, campaign.id, { levelsCleared: 1 });

    const res = await request(app)
      .delete(`/api/campaigns/${campaign.id}`)
      .set("Authorization", authHeader);
    expect(res.status).toBe(200);

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
  });

  test("non-owner cannot delete (403)", async () => {
    const owner = await createUserWithSession({ email: "o2@example.com" });
    const intruder = await createUserWithSession({
      username: "intruder2",
      email: "i2@example.com",
    });
    const [lvl] = await makeSoloLevels(owner.player.id, 1);
    const campaign = await createCampaign(owner.player.id, [lvl.id]);

    const res = await request(app)
      .delete(`/api/campaigns/${campaign.id}`)
      .set("Authorization", intruder.authHeader);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/campaigns/:id/runs", () => {
  test("records an authenticated run with the player id", async () => {
    const { player, authHeader } = await createUserWithSession();
    const levels = await makeSoloLevels(player.id, 3);
    const campaign = await createCampaign(
      player.id,
      levels.map((l) => l.id)
    );

    const res = await request(app)
      .post(`/api/campaigns/${campaign.id}/runs`)
      .set("Authorization", authHeader)
      .send({
        levelsCleared: 2,
        livesLeft: 1,
        completed: false,
        timeMs: 12345,
      });
    expect(res.status).toBe(200);

    const rows = await db
      .select()
      .from(schema.campaignRuns)
      .where(eq(schema.campaignRuns.campaignId, campaign.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].playerId).toBe(player.id);
    expect(rows[0].levelsCleared).toBe(2);
    expect(rows[0].timeMs).toBe(12345);
  });

  test("records an anonymous run (player id null)", async () => {
    const { player } = await createUserWithSession();
    const [lvl] = await makeSoloLevels(player.id, 1);
    const campaign = await createCampaign(player.id, [lvl.id]);

    const res = await request(app)
      .post(`/api/campaigns/${campaign.id}/runs`)
      .send({ levelsCleared: 1, completed: true, timeMs: 1000 });
    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(schema.campaignRuns)
      .where(eq(schema.campaignRuns.campaignId, campaign.id));
    expect(rows[0].playerId).toBeNull();
    expect(rows[0].completed).toBe(true);
  });

  test("rejects missing required fields (400) and unknown campaign (404)", async () => {
    const { player, authHeader } = await createUserWithSession();
    const [lvl] = await makeSoloLevels(player.id, 1);
    const campaign = await createCampaign(player.id, [lvl.id]);

    const bad = await request(app)
      .post(`/api/campaigns/${campaign.id}/runs`)
      .set("Authorization", authHeader)
      .send({ livesLeft: 1 }); // missing levelsCleared/completed/timeMs
    expect(bad.status).toBe(400);

    const missing = await request(app)
      .post("/api/campaigns/999999/runs")
      .send({ levelsCleared: 0, completed: false, timeMs: 0 });
    expect(missing.status).toBe(404);
  });
});
