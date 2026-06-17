// Password-reset token handling for the "forgot password" flow. Mirrors
// auth/session.ts: the token handed to the user (embedded in the emailed link)
// is a random 120-char string, but only its SHA-256 hash is persisted, so a
// leaked database can't be used to reset anyone's password. Tokens are
// single-use (consumed atomically with DELETE ... RETURNING) and short-lived
// (1-hour expiry enforced in the DB default and re-checked on consume).
import crypto from "crypto";
import { db, schema } from "@ouigame/db";
import { eq, and, gt } from "drizzle-orm";
import { makeid } from "@ouigame/shared/game";

const { passwordResetTokens } = schema;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// Issues a fresh reset token for a player and returns the *plaintext* token
// (the only time it exists outside the emailed link). Any outstanding tokens for
// the player are dropped first so only the most recent link ever works.
async function createResetToken(playerId: number) {
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.playerId, playerId));
  const token = makeid(120);
  await db.insert(passwordResetTokens).values({
    playerId,
    tokenHash: hashToken(token),
  });
  return token;
}

// Atomically consumes a plaintext token: deletes the matching unexpired row and
// returns its playerId, or null if the token is missing/expired/already used.
// Doing the lookup and deletion in one statement makes the token single-use even
// under concurrent submits.
async function consumeResetToken(token: string | null | undefined) {
  if (!token) return null;
  const rows = await db
    .delete(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(token)),
        gt(passwordResetTokens.expirationTimestamp, new Date())
      )
    )
    .returning({ playerId: passwordResetTokens.playerId });
  return rows.length > 0 ? rows[0]!.playerId : null;
}

export { hashToken, createResetToken, consumeResetToken };
