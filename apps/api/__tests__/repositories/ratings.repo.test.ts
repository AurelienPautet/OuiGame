import { getRating, upsertRating } from "../../repositories/ratings.repo";
import { db, schema } from "@ouigame/db";
import { eq } from "drizzle-orm";
import { cleanDb, createPlayer, createLevel } from "../helpers/db";

// Isolation tests for the ratings repo. Freezes the false-vs-value distinction
// (no row -> false, which the socket/level code relies on) and the
// insert-then-update upsert path (one row per player+level, not two).

beforeEach(async () => {
  await cleanDb();
});

test("getRating returns false when the player has not rated the level", async () => {
  const player = await createPlayer();
  const level = await createLevel(player.id);
  expect(await getRating(level.id, player.id)).toBe(false);
});

test("upsertRating inserts then updates a single row", async () => {
  const player = await createPlayer();
  const level = await createLevel(player.id);

  await upsertRating(level.id, player.id, 3);
  expect(await getRating(level.id, player.id)).toBe(3);

  await upsertRating(level.id, player.id, 5); // update, not a second row
  expect(await getRating(level.id, player.id)).toBe(5);

  const rows = await db
    .select()
    .from(schema.ratings)
    .where(eq(schema.ratings.levelId, level.id));
  expect(rows).toHaveLength(1);
});
