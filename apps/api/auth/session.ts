// Centralized session-token handling shared by the HTTP middleware, the auth
// routes, and the Socket.io connection handler.
//
// Tokens are random 120-char strings handed to the client, but only their
// SHA-256 hash is persisted. A leaked database therefore cannot be used to
// impersonate users. SHA-256 (not bcrypt) is used deliberately: the token is
// already high-entropy, and an unsalted deterministic hash lets us look the
// session up by hash instead of scanning every row.
import crypto from "crypto";
import { db, schema } from "@ouigame/db";
import { eq, and, gt } from "drizzle-orm";
import { makeid } from "@ouigame/shared/game";

const { playerSessions, players } = schema;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// Creates a new session and returns the *plaintext* token (the only time it
// exists outside the client).
async function createSession(playerId: number) {
  const token = makeid(120);
  await db.insert(playerSessions).values({
    playerId,
    sessionToken: hashToken(token),
  });
  return token;
}

// Resolves a plaintext token to a user record, or null if missing/expired.
async function verifySession(token: string | null | undefined) {
  if (!token) return null;
  const result = await db
    .select({
      playerId: players.id,
      username: players.username,
      email: players.email,
    })
    .from(playerSessions)
    .innerJoin(players, eq(players.id, playerSessions.playerId))
    .where(
      and(
        eq(playerSessions.sessionToken, hashToken(token)),
        gt(playerSessions.expirationTimestamp, new Date())
      )
    );
  return result.length > 0 ? result[0] : null;
}

async function deleteSession(token: string | null | undefined) {
  if (!token) return;
  await db
    .delete(playerSessions)
    .where(eq(playerSessions.sessionToken, hashToken(token)));
}

export { hashToken, createSession, verifySession, deleteSession };
