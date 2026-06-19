/**
 * Admin bootstrap script — grant (or revoke) the is_admin flag on a player.
 *
 * Usage:
 *   pnpm set-admin <username-or-email>            # grant admin
 *   pnpm set-admin <username-or-email> --revoke   # revoke admin
 *
 * There is no in-app way to create the first admin (admin routes already
 * require an admin), so this CLI is the trusted entry point.
 *
 * Standalone one-off script: load the root .env ourselves (the @ouigame/db
 * connection no longer loads dotenv — env is the caller's responsibility).
 */

// MUST be first: load the root .env before @ouigame/db creates its pool.
import "../env";

import { db, schema } from "@ouigame/db";
import { eq, or } from "drizzle-orm";

const { players } = schema;

async function setAdmin() {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const identifier = args.find((arg) => arg !== "--revoke");

  if (!identifier) {
    console.error("Usage: pnpm set-admin <username-or-email> [--revoke]");
    process.exit(1);
  }

  try {
    // Match either the username OR the email column.
    const updated = await db
      .update(players)
      .set({ isAdmin: !revoke })
      .where(
        or(eq(players.username, identifier), eq(players.email, identifier))
      )
      .returning({
        id: players.id,
        username: players.username,
        email: players.email,
        isAdmin: players.isAdmin,
      });

    const player = updated[0];
    if (!player) {
      console.error(`No player found matching "${identifier}".`);
      process.exit(1);
    }

    console.log(`${revoke ? "Revoked admin from" : "Granted admin to"}:`);
    console.log(player);
    process.exit(0);
  } catch (err) {
    console.error(
      "✗ set-admin error:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}

setAdmin();
