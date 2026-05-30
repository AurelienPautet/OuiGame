import request from "supertest";

// Mock Google token verification so the /google endpoint can be tested without
// real OAuth. jest.mock is hoisted above the imports below.
jest.mock("../../auth_server", () => ({
  verifyToken: jest.fn(),
  signupbis: jest.fn(),
}));

import { verifyToken } from "../../auth_server";
import { buildApp } from "../helpers/app";
import { db, schema, cleanDb, createPlayer } from "../helpers/db";
import { eq } from "drizzle-orm";

const app = buildApp();

beforeEach(async () => {
  await cleanDb();
  jest.clearAllMocks();
});

describe("POST /api/auth/signup", () => {
  test("creates a player and returns a session token", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      username: "bob",
      email: "bob@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      username: "bob",
      email: "bob@example.com",
    });
    expect(typeof res.body.sessionToken).toBe("string");
    expect(res.body.sessionToken.length).toBeGreaterThan(0);

    const rows = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.email, "bob@example.com"));
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("db");
    // Password must be hashed, never stored in plaintext.
    expect(rows[0].passwordHash).not.toBe("secret123");
  });

  test("rejects a duplicate username (400)", async () => {
    await createPlayer({ username: "taken", email: "a@example.com" });
    const res = await request(app).post("/api/auth/signup").send({
      username: "taken",
      email: "new@example.com",
      password: "secret123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("username");
  });

  test("rejects a duplicate email (400)", async () => {
    await createPlayer({ username: "someone", email: "dup@example.com" });
    const res = await request(app).post("/api/auth/signup").send({
      username: "different",
      email: "dup@example.com",
      password: "secret123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("email");
  });
});

describe("POST /api/auth/login", () => {
  test("logs in with correct credentials", async () => {
    const player = await createPlayer({
      username: "carol",
      email: "carol@example.com",
      password: "mypassword",
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "carol@example.com", password: "mypassword" });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("carol");
    expect(typeof res.body.sessionToken).toBe("string");

    const sessions = await db
      .select()
      .from(schema.playerSessions)
      .where(eq(schema.playerSessions.playerId, player.id));
    expect(sessions).toHaveLength(1);
  });

  test("rejects an unknown email (401)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("email");
  });

  test("rejects a wrong password (401)", async () => {
    await createPlayer({
      email: "dave@example.com",
      password: "correct-password",
    });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "dave@example.com", password: "wrong-password" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("password");
  });
});

describe("GET /api/auth/verify-session", () => {
  test("returns the user for a valid token", async () => {
    const signup = await request(app).post("/api/auth/signup").send({
      username: "erin",
      email: "erin@example.com",
      password: "secret123",
    });
    const token = signup.body.sessionToken;

    const res = await request(app)
      .get("/api/auth/verify-session")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: "erin", email: "erin@example.com" });
  });

  test("rejects without a token (401)", async () => {
    const res = await request(app).get("/api/auth/verify-session");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  test("invalidates the session token", async () => {
    const signup = await request(app).post("/api/auth/signup").send({
      username: "frank",
      email: "frank@example.com",
      password: "secret123",
    });
    const token = signup.body.sessionToken;

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logout.status).toBe(200);
    expect(logout.body.success).toBe(true);

    // The token should no longer be valid.
    const verify = await request(app)
      .get("/api/auth/verify-session")
      .set("Authorization", `Bearer ${token}`);
    expect(verify.status).toBe(401);
  });
});

describe("POST /api/auth/google", () => {
  test("requires a username for a brand-new Google user (400)", async () => {
    verifyToken.mockResolvedValue({
      userId: "google-123",
      email: "newg@example.com",
      name: "New G",
    });

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "fake-token" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("username_required");
  });

  test("creates a Google account when a username is supplied", async () => {
    verifyToken.mockResolvedValue({
      userId: "google-456",
      email: "grace@example.com",
      name: "Grace",
    });

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "fake-token", username: "grace" });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("grace");
    expect(typeof res.body.sessionToken).toBe("string");

    const rows = await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.googleId, "google-456"));
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("google");
  });

  test("logs in an existing Google user without needing a username", async () => {
    // First call creates the account.
    verifyToken.mockResolvedValue({
      userId: "google-789",
      email: "heidi@example.com",
      name: "Heidi",
    });
    await request(app)
      .post("/api/auth/google")
      .send({ idToken: "t", username: "heidi" });

    // Second call (same googleId) logs in, no username required.
    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "t" });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("heidi");
  });
});
