const request = require("supertest");
const { buildApp } = require("../helpers/app");
const {
  db,
  schema,
  cleanDb,
  createUserWithSession,
  createLevel,
} = require("../helpers/db");
const { eq, and } = require("drizzle-orm");

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
});

describe("GET /api/levels", () => {
  test("returns only 'up' online levels by default", async () => {
    const { player } = await createUserWithSession();
    await createLevel(player.id, { name: "OnlineA", type: "online" });
    await createLevel(player.id, { name: "SoloA", type: "solo" });
    await createLevel(player.id, {
      name: "DownA",
      type: "online",
      status: "down",
    });

    const res = await request(app).get("/api/levels");
    expect(res.status).toBe(200);
    const names = res.body.map((l) => l.level_name);
    expect(names).toContain("OnlineA");
    expect(names).not.toContain("SoloA");
    expect(names).not.toContain("DownA");
  });

  test("filters by name substring", async () => {
    const { player } = await createUserWithSession();
    await createLevel(player.id, { name: "Castle", type: "online" });
    await createLevel(player.id, { name: "Desert", type: "online" });

    const res = await request(app).get("/api/levels").query({ name: "Cast" });
    expect(res.status).toBe(200);
    expect(res.body.map((l) => l.level_name)).toEqual(["Castle"]);
  });

  test("filters by type=solo", async () => {
    const { player } = await createUserWithSession();
    await createLevel(player.id, { name: "SoloOnly", type: "solo" });
    await createLevel(player.id, { name: "OnlineOnly", type: "online" });

    const res = await request(app).get("/api/levels").query({ type: "solo" });
    expect(res.body.map((l) => l.level_name)).toEqual(["SoloOnly"]);
  });

  test("includes the creator's username", async () => {
    const { player } = await createUserWithSession({ username: "mapmaker" });
    await createLevel(player.id, { name: "Mine", type: "online" });

    const res = await request(app).get("/api/levels");
    expect(res.body[0].level_creator_name).toBe("mapmaker");
  });
});

describe("GET /api/levels/:id", () => {
  test("returns a single level", async () => {
    const { player } = await createUserWithSession();
    const level = await createLevel(player.id, { name: "Single" });

    const res = await request(app).get(`/api/levels/${level.id}`);
    expect(res.status).toBe(200);
    expect(res.body.level_id).toBe(level.id);
    expect(res.body.level_name).toBe("Single");
  });

  test("returns 404 for a missing level", async () => {
    const res = await request(app).get("/api/levels/999999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/levels/:id/json", () => {
  test("returns the level content payload", async () => {
    const { player } = await createUserWithSession({ username: "author" });
    const level = await createLevel(player.id, {
      name: "WithJson",
      content: { data: [1, 2, 3] },
    });

    const res = await request(app).get(`/api/levels/${level.id}/json`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([1, 2, 3]);
    expect(res.body.level_name).toBe("WithJson");
    expect(res.body.level_creator_name).toBe("author");
  });

  test("returns 404 for a missing level", async () => {
    const res = await request(app).get("/api/levels/999999/json");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/levels", () => {
  test("creates a level with image data when authenticated", async () => {
    const { player, authHeader } = await createUserWithSession();

    const res = await request(app)
      .post("/api/levels")
      .set("Authorization", authHeader)
      .send({
        levelData: { data: [] },
        hexData: "ab12cd",
        levelName: "Created",
        maxPlayers: 4,
        type: "online",
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.levelId).toBe("number");

    const rows = await db
      .select()
      .from(schema.levels)
      .where(eq(schema.levels.id, res.body.levelId));
    expect(rows[0].name).toBe("Created");
    expect(rows[0].creatorId).toBe(player.id);

    const imgs = await db
      .select()
      .from(schema.levelsImg)
      .where(eq(schema.levelsImg.levelId, res.body.levelId));
    expect(imgs).toHaveLength(1);
  });

  test("rejects unauthenticated requests (401)", async () => {
    const res = await request(app)
      .post("/api/levels")
      .send({ levelName: "Nope", maxPlayers: 2, type: "online" });
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/levels/:id", () => {
  test("updates the owner's level", async () => {
    const { player, authHeader } = await createUserWithSession();
    const level = await createLevel(player.id, {
      name: "Before",
      img: "0011",
    });

    const res = await request(app)
      .put(`/api/levels/${level.id}`)
      .set("Authorization", authHeader)
      .send({
        levelData: { data: [9] },
        hexData: "ffee",
        levelName: "After",
        maxPlayers: 6,
        type: "online",
      });

    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(schema.levels)
      .where(eq(schema.levels.id, level.id));
    expect(rows[0].name).toBe("After");
    expect(rows[0].maxPlayers).toBe(6);
  });

  test("refuses to update a level owned by someone else (403)", async () => {
    const owner = await createUserWithSession({
      username: "owner",
      email: "owner@example.com",
    });
    const other = await createUserWithSession({
      username: "intruder",
      email: "intruder@example.com",
    });
    const level = await createLevel(owner.player.id, { name: "Owned" });

    const res = await request(app)
      .put(`/api/levels/${level.id}`)
      .set("Authorization", other.authHeader)
      .send({
        levelData: { data: [] },
        hexData: "00",
        levelName: "Hijacked",
        maxPlayers: 2,
        type: "online",
      });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/levels/:id", () => {
  test("deletes the owner's level and its image/ratings", async () => {
    const { player, authHeader } = await createUserWithSession();
    const level = await createLevel(player.id, { name: "ToDelete", img: "aa" });

    const res = await request(app)
      .delete(`/api/levels/${level.id}`)
      .set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rows = await db
      .select()
      .from(schema.levels)
      .where(eq(schema.levels.id, level.id));
    expect(rows).toHaveLength(0);
  });

  test("refuses to delete someone else's level (403)", async () => {
    const owner = await createUserWithSession({
      username: "o2",
      email: "o2@example.com",
    });
    const other = await createUserWithSession({
      username: "i2",
      email: "i2@example.com",
    });
    const level = await createLevel(owner.player.id, { name: "Protected" });

    const res = await request(app)
      .delete(`/api/levels/${level.id}`)
      .set("Authorization", other.authHeader);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/levels/:id/rate", () => {
  test("inserts a rating, then updates it on a second call", async () => {
    const { player, authHeader } = await createUserWithSession();
    const level = await createLevel(player.id, { name: "Rateable" });

    const first = await request(app)
      .post(`/api/levels/${level.id}/rate`)
      .set("Authorization", authHeader)
      .send({ stars: 3 });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/levels/${level.id}/rate`)
      .set("Authorization", authHeader)
      .send({ stars: 5 });
    expect(second.status).toBe(200);

    const rows = await db
      .select()
      .from(schema.ratings)
      .where(
        and(
          eq(schema.ratings.levelId, level.id),
          eq(schema.ratings.playerId, player.id)
        )
      );
    // Still a single rating row, now updated to 5 stars.
    expect(rows).toHaveLength(1);
    expect(rows[0].stars).toBe(5);
  });
});

describe("GET /api/levels/my", () => {
  test("returns only the authenticated user's levels", async () => {
    const me = await createUserWithSession({
      username: "me",
      email: "me@example.com",
    });
    const them = await createUserWithSession({
      username: "them",
      email: "them@example.com",
    });
    await createLevel(me.player.id, { name: "MyLevel" });
    await createLevel(them.player.id, { name: "TheirLevel" });

    const res = await request(app)
      .get("/api/levels/my")
      .set("Authorization", me.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.map((l) => l.level_name)).toEqual(["MyLevel"]);
  });
});
