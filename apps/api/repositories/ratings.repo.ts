// Pure Drizzle queries for ratings. NO req/res, NO business rules.
import { db, schema } from "@ouigame/db";
import { eq, and } from "drizzle-orm";

const { ratings } = schema;

// A player's star rating for a level, or false when they haven't rated it.
async function getRating(levelId: number, playerId: number) {
  const res = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.playerId, playerId), eq(ratings.levelId, levelId)));
  return res.length > 0 ? res[0].stars : false;
}

// Insert a rating, or update the existing one (one row per player+level).
async function upsertRating(levelId: number, playerId: number, stars: number) {
  const existing = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.playerId, playerId), eq(ratings.levelId, levelId)));

  if (existing.length === 0) {
    await db.insert(ratings).values({ playerId, levelId, stars });
  } else {
    await db
      .update(ratings)
      .set({ stars })
      .where(and(eq(ratings.playerId, playerId), eq(ratings.levelId, levelId)));
  }
}

export { getRating, upsertRating };
