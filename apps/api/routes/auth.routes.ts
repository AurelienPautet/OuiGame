import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import bcrypt from "bcryptjs";
import { db, schema } from "@ouigame/db";
const { players, logings, playerSessions } = schema;
import { eq } from "drizzle-orm";
import { verifyToken } from "../auth_server";
import { authMiddleware } from "../middleware/auth.middleware";
import { createSession, deleteSession } from "../auth/session";
import { createResetToken, consumeResetToken } from "../auth/passwordReset";
import { sendPasswordResetEmail } from "../services/email.service";
import { HttpError } from "../errors";

// Public base URL of the web client, used to build the password-reset link that
// goes in the email. The client uses a HashRouter, so the route lives after the
// '#'. Overridable via WEB_URL (set it to the Vite dev origin locally); the
// fallback targets production.
const WEB_URL = process.env.WEB_URL ?? "https://wiitank.pautet.net";

// Linear (non-backtracking) email check: domain labels exclude '.', so there
// is no overlapping-quantifier ambiguity and no polynomial-time worst case.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// Returns an error message string if the credentials are invalid, else null.
function validateCredentials({
  username,
  email,
  password,
}: {
  username?: unknown;
  email?: unknown;
  password?: unknown;
}) {
  if (email !== undefined) {
    // Length is checked first so the regex never runs on oversized input.
    if (typeof email !== "string" || email.length > 60 || !EMAIL_RE.test(email))
      return "A valid email is required";
  }
  if (username !== undefined) {
    if (
      typeof username !== "string" ||
      username.length < 3 ||
      username.length > 30
    )
      return "Username must be between 3 and 30 characters";
  }
  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 8)
      return "Password must be at least 8 characters";
  }
  return null;
}

async function logAttempt(
  email: string,
  ipAddress: string | undefined,
  status: string
) {
  try {
    const res = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.email, email));
    const player = res[0];
    if (player === undefined) return;
    await db.insert(logings).values({
      playerId: player.id,
      // ip_address is NOT NULL; req.ip can be undefined (e.g. no trust-proxy /
      // unknown socket), so record an empty string rather than failing insert.
      ipAddress: ipAddress ?? "",
      status: status,
    });
  } catch (err) {
    console.error("Error logging attempt:", err);
  }
}

// POST /api/auth/signup
router.post("/signup", async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  const ipAddress = req.ip;

  const invalid = validateCredentials({ username, email, password });
  if (invalid) {
    throw new HttpError(400, { error: "validation", message: invalid });
  }

  let result = await db
    .select()
    .from(players)
    .where(eq(players.username, username));
  if (result.length > 0) {
    throw new HttpError(400, {
      error: "username",
      message: "Username already taken",
    });
  }

  result = await db.select().from(players).where(eq(players.email, email));
  if (result.length > 0) {
    throw new HttpError(400, {
      error: "email",
      message: "Email already registered",
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const insertResult = await db
    .insert(players)
    .values({
      username,
      email,
      passwordHash: hashedPassword,
      type: "db",
    })
    .returning({ id: players.id });

  // A single-row insert with .returning() always yields exactly one row.
  const playerId = insertResult[0]!.id;
  const sessionToken = await createSession(playerId);

  await logAttempt(email, ipAddress, "sign_up_success");

  res.json({ username, email, sessionToken });
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ipAddress = req.ip;

  const invalid = validateCredentials({ email, password });
  if (invalid) {
    throw new HttpError(400, { error: "validation", message: invalid });
  }

  const result = await db
    .select()
    .from(players)
    .where(eq(players.email, email));

  const user = result[0];
  if (user === undefined) {
    throw new HttpError(401, { error: "email", message: "Email not found" });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash as string);

  if (!isMatch) {
    await logAttempt(email, ipAddress, "login_failed_wrong_password");
    throw new HttpError(401, {
      error: "password",
      message: "Invalid password",
    });
  }

  const sessionToken = await createSession(user.id);
  await logAttempt(email, ipAddress, "login_success");

  res.json({ username: user.username, email: user.email, sessionToken });
});

// POST /api/auth/google
router.post("/google", async (req: Request, res: Response) => {
  const { idToken, username } = req.body;
  const ipAddress = req.ip;

  const userInfo = await verifyToken(idToken);
  const email = userInfo.email;
  const googleId = userInfo.userId;

  let result = await db
    .select()
    .from(players)
    .where(eq(players.googleId, googleId));

  const user = result[0];
  if (user !== undefined) {
    const sessionToken = await createSession(user.id);
    await logAttempt(user.email, ipAddress, "login_success_google");
    return res.json({
      username: user.username,
      email: user.email,
      sessionToken,
    });
  }

  if (!username) {
    throw new HttpError(400, {
      error: "username_required",
      message: "Username required for new Google users",
    });
  }

  result = await db
    .select()
    .from(players)
    .where(eq(players.username, username));
  if (result.length > 0) {
    throw new HttpError(400, {
      error: "username",
      message: "Username already taken",
    });
  }

  // The Google token's email is optional; players.email is NOT NULL, so a
  // token without a verified email can't create an account.
  if (!email) {
    throw new HttpError(400, {
      error: "email_required",
      message: "Google account has no verified email",
    });
  }

  const insertResult = await db
    .insert(players)
    .values({
      username,
      email,
      googleId,
      type: "google",
    })
    .returning({ id: players.id });

  // A single-row insert with .returning() always yields exactly one row.
  const sessionToken = await createSession(insertResult[0]!.id);
  await logAttempt(email, ipAddress, "signup_success_google");

  res.json({ username, email, sessionToken });
});

// GET /api/auth/verify-session
router.get("/verify-session", authMiddleware, (req: Request, res: Response) => {
  res.json({ username: req.user!.username, email: req.user!.email });
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, async (req: Request, res: Response) => {
  const sessionToken = req.headers.authorization?.replace("Bearer ", "");
  await deleteSession(sessionToken);
  await logAttempt(req.user!.email, req.ip, "logout_success");
  res.json({ success: true });
});

// POST /api/auth/forgot-password
// Always returns the same generic success response whether or not the email is
// registered, so the endpoint can't be used to enumerate accounts. The actual
// work (issuing a token + sending the email) happens only for existing "db"-type
// accounts. Email/provider failures are swallowed for the same reason — they
// must not change the response. Abuse is bounded by the global API rate limiter
// (see server.ts) and by createResetToken invalidating prior tokens.
router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  const ipAddress = req.ip;

  const invalid = validateCredentials({ email });
  if (invalid) {
    throw new HttpError(400, { error: "email", message: invalid });
  }

  const result = await db
    .select()
    .from(players)
    .where(eq(players.email, email));
  const user = result[0];

  // Google accounts have no password to reset; they sign in via Google. Skip
  // them silently (still returning the uniform response below).
  if (user !== undefined && user.type === "db") {
    try {
      const token = await createResetToken(user.id);
      const resetUrl = `${WEB_URL}/#/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, user.username, resetUrl);
      await logAttempt(email, ipAddress, "password_reset_requested");
    } catch (err) {
      // Never surface email/provider errors: doing so would both leak that the
      // address exists and break the uniform response.
      console.error("Error sending password reset email:", err);
    }
  }

  res.json({ success: true });
});

// POST /api/auth/reset-password
// Consumes a one-time token (single-use, atomic) and sets the new password. All
// of the user's existing sessions are then invalidated so a session that was
// open before the reset can't outlive it.
router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body;
  const ipAddress = req.ip;

  const invalid = validateCredentials({ password });
  if (invalid) {
    throw new HttpError(400, { error: "password", message: invalid });
  }
  if (typeof token !== "string" || token.length === 0) {
    throw new HttpError(400, {
      error: "token",
      message: "Invalid or expired reset link",
    });
  }

  const playerId = await consumeResetToken(token);
  if (playerId === null) {
    throw new HttpError(400, {
      error: "token",
      message: "Invalid or expired reset link",
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  await db
    .update(players)
    .set({ passwordHash: hashedPassword })
    .where(eq(players.id, playerId));

  // Invalidate every existing session for this user — a password reset should
  // log out anyone (including an attacker) holding an old token.
  await db.delete(playerSessions).where(eq(playerSessions.playerId, playerId));

  const rows = await db
    .select({ email: players.email })
    .from(players)
    .where(eq(players.id, playerId));
  const userEmail = rows[0]?.email;
  if (userEmail)
    await logAttempt(userEmail, ipAddress, "password_reset_success");

  res.json({ success: true });
});

export default router;
