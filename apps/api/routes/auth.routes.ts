import express from "express";
import type { Request, Response } from "express";
const router = express.Router();
import bcrypt from "bcryptjs";
import { db, schema } from "@ouigame/db";
const { players, logings } = schema;
import { eq } from "drizzle-orm";
import { verifyToken } from "../auth_server";
import { authMiddleware } from "../middleware/auth.middleware";
import { createSession, deleteSession } from "../auth/session";

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
    return res.status(400).json({ error: "validation", message: invalid });
  }

  try {
    let result = await db
      .select()
      .from(players)
      .where(eq(players.username, username));
    if (result.length > 0) {
      return res
        .status(400)
        .json({ error: "username", message: "Username already taken" });
    }

    result = await db.select().from(players).where(eq(players.email, email));
    if (result.length > 0) {
      return res
        .status(400)
        .json({ error: "email", message: "Email already registered" });
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
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "server", message: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ipAddress = req.ip;

  const invalid = validateCredentials({ email, password });
  if (invalid) {
    return res.status(400).json({ error: "validation", message: invalid });
  }

  try {
    const result = await db
      .select()
      .from(players)
      .where(eq(players.email, email));

    const user = result[0];
    if (user === undefined) {
      return res
        .status(401)
        .json({ error: "email", message: "Email not found" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash as string);

    if (!isMatch) {
      await logAttempt(email, ipAddress, "login_failed_wrong_password");
      return res
        .status(401)
        .json({ error: "password", message: "Invalid password" });
    }

    const sessionToken = await createSession(user.id);
    await logAttempt(email, ipAddress, "login_success");

    res.json({ username: user.username, email: user.email, sessionToken });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "server", message: "Login failed" });
  }
});

// POST /api/auth/google
router.post("/google", async (req: Request, res: Response) => {
  const { idToken, username } = req.body;
  const ipAddress = req.ip;

  try {
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
      return res.status(400).json({
        error: "username_required",
        message: "Username required for new Google users",
      });
    }

    result = await db
      .select()
      .from(players)
      .where(eq(players.username, username));
    if (result.length > 0) {
      return res
        .status(400)
        .json({ error: "username", message: "Username already taken" });
    }

    // The Google token's email is optional; players.email is NOT NULL, so a
    // token without a verified email can't create an account.
    if (!email) {
      return res.status(400).json({
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
  } catch (err) {
    console.error("Google login error:", err);
    res
      .status(500)
      .json({ error: "server", message: "Google authentication failed" });
  }
});

// GET /api/auth/verify-session
router.get("/verify-session", authMiddleware, (req: Request, res: Response) => {
  res.json({ username: req.user!.username, email: req.user!.email });
});

// POST /api/auth/logout
router.post("/logout", authMiddleware, async (req: Request, res: Response) => {
  try {
    const sessionToken = req.headers.authorization?.replace("Bearer ", "");
    await deleteSession(sessionToken);
    await logAttempt(req.user!.email, req.ip, "logout_success");
    res.json({ success: true });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "server", message: "Logout failed" });
  }
});

export default router;
