import request from "supertest";

// Mock Google token verification so the /google endpoint can be tested without
// real OAuth. jest.mock is hoisted above the imports below.
jest.mock("../../auth_server", () => ({
  verifyToken: jest.fn(),
  signupbis: jest.fn(),
}));

// Mock the email service so /forgot-password never hits Resend; we assert on the
// call args (the reset link) instead of sending real mail.
jest.mock("../../services/email.service", () => ({
  sendPasswordResetEmail: jest.fn(),
  isEmailConfigured: jest.fn(() => true),
  sendEmail: jest.fn(),
}));

import { verifyToken } from "../../auth_server";
import { sendPasswordResetEmail } from "../../services/email.service";
import { createResetToken } from "../../auth/passwordReset";
import { buildApp } from "../helpers/app";
import {
  db,
  schema,
  cleanDb,
  createPlayer,
  createSession,
} from "../helpers/db";
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

describe("POST /api/auth/forgot-password", () => {
  test("issues a token and sends an email for an existing db account", async () => {
    const player = await createPlayer({
      username: "ivy",
      email: "ivy@example.com",
    });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "ivy@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    // A reset token row was created for the player.
    const tokens = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.playerId, player.id));
    expect(tokens).toHaveLength(1);

    // The email was sent with a link carrying a token.
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [to, username, resetUrl] = sendPasswordResetEmail.mock.calls[0];
    expect(to).toBe("ivy@example.com");
    expect(username).toBe("ivy");
    expect(resetUrl).toContain("/reset-password?token=");
  });

  test("returns success but does nothing for an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    const tokens = await db.select().from(schema.passwordResetTokens);
    expect(tokens).toHaveLength(0);
  });

  test("does not send a reset email to a Google account", async () => {
    await createPlayer({
      username: "glen",
      email: "glen@example.com",
      type: "google",
      googleId: "google-glen",
      passwordHash: null,
    });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "glen@example.com" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("rejects an invalid email (400)", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("email");
  });
});

describe("POST /api/auth/reset-password", () => {
  test("sets a new password and invalidates existing sessions", async () => {
    const player = await createPlayer({
      username: "jane",
      email: "jane@example.com",
      password: "old-password",
    });
    // A session opened before the reset — it must not survive it.
    const oldToken = await createSession(player.id);
    const resetToken = await createResetToken(player.id);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, password: "brand-new-pass" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    // Old password no longer works; the new one does.
    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "old-password" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "jane@example.com", password: "brand-new-pass" });
    expect(newLogin.status).toBe(200);

    // The pre-reset session is gone.
    const verify = await request(app)
      .get("/api/auth/verify-session")
      .set("Authorization", `Bearer ${oldToken}`);
    expect(verify.status).toBe(401);
  });

  test("rejects an invalid token (400)", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", password: "whatever123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("token");
  });

  test("rejects a token that was already used (single-use)", async () => {
    const player = await createPlayer({ email: "ken@example.com" });
    const resetToken = await createResetToken(player.id);

    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, password: "first-new-pass" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, password: "second-new-pass" });
    expect(second.status).toBe(400);
    expect(second.body.error).toBe("token");
  });

  test("rejects a short password without consuming the token", async () => {
    const player = await createPlayer({ email: "liz@example.com" });
    const resetToken = await createResetToken(player.id);

    const short = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, password: "short" });
    expect(short.status).toBe(400);
    expect(short.body.error).toBe("password");

    // The token was not consumed, so it still works with a valid password.
    const ok = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: resetToken, password: "valid-password" });
    expect(ok.status).toBe(200);
  });
});
