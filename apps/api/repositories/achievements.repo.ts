// Achievements repository — PURE Drizzle queries over the player_achievements
// unlock ledger. No req/res, no business rules; the service supplies the keys
// to unlock and reads back what was newly inserted.
import { db, schema } from "@ouigame/db";
import { eq } from "drizzle-orm";

const { playerAchievements } = schema;

// All achievement keys this player has already unlocked.
async function getUnlockedKeys(playerId: number): Promise<string[]> {
  const rows = await db
    .select({ key: playerAchievements.achievementKey })
    .from(playerAchievements)
    .where(eq(playerAchievements.playerId, playerId));
  return rows.map((r) => r.key);
}

// The player's unlocked rows with their timestamps (for the profile grid).
async function getUnlockedRows(
  playerId: number
): Promise<{ key: string; unlockedAt: Date | null }[]> {
  return db
    .select({
      key: playerAchievements.achievementKey,
      unlockedAt: playerAchievements.unlockedAt,
    })
    .from(playerAchievements)
    .where(eq(playerAchievements.playerId, playerId));
}

// Insert the given keys for the player, IGNORING any already unlocked (the
// (player_id, achievement_key) UNIQUE constraint). Returns only the keys that
// were actually newly inserted — so the DB itself does the "is this new?" diff,
// which keeps unlocking idempotent under concurrent round ends.
async function insertUnlocks(
  playerId: number,
  keys: string[]
): Promise<string[]> {
  if (keys.length === 0) return [];
  const inserted = await db
    .insert(playerAchievements)
    .values(keys.map((achievementKey) => ({ playerId, achievementKey })))
    .onConflictDoNothing()
    .returning({ key: playerAchievements.achievementKey });
  return inserted.map((r) => r.key);
}

export { getUnlockedKeys, getUnlockedRows, insertUnlocks };
