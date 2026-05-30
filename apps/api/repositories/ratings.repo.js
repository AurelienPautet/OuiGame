// Pure Drizzle queries for ratings. NO req/res, NO business rules.
const { db, schema } = require("@ouigame/db");
const { ratings } = schema;
const { eq, and } = require("drizzle-orm");

// A player's star rating for a level, or false when they haven't rated it.
async function getRating(levelId, playerId) {
  const res = await db
    .select()
    .from(ratings)
    .where(and(eq(ratings.playerId, playerId), eq(ratings.levelId, levelId)));
  return res.length > 0 ? res[0].stars : false;
}

// Insert a rating, or update the existing one (one row per player+level).
async function upsertRating(levelId, playerId, stars) {
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

module.exports = { getRating, upsertRating };
