import { db, schema } from "@ouigame/db";
import { eq } from "drizzle-orm";
import { upsertRating } from "../../repositories/ratings.repo";
import {
  cleanDb,
  createPlayer,
  createLevel,
  createRound,
  createSoloRound,
  createCampaign,
} from "../helpers/db";

// Guards the ON DELETE CASCADE wiring: deleting a level must take its dependent
// rows (image, rounds, solo rounds, ratings, campaign_levels) with it. A dropped
// cascade here would leave orphaned rows that the analyzers/aggregates trip on.

beforeEach(async () => {
  await cleanDb();
});

test("deleting a level cascades to all level-linked rows", async () => {
  const player = await createPlayer();
  const level = await createLevel(player.id, { img: "6162" });
  await createRound(player.id, level.id, { kills: 1 });
  await createSoloRound(player.id, level.id, { success: true });
  await upsertRating(level.id, player.id, 4);
  await createCampaign(player.id, [level.id]);

  await db.delete(schema.levels).where(eq(schema.levels.id, level.id));

  const counts = async (table: any, col: any) =>
    (await db.select().from(table).where(eq(col, level.id))).length;

  expect(await counts(schema.levelsImg, schema.levelsImg.levelId)).toBe(0);
  expect(await counts(schema.rounds, schema.rounds.levelId)).toBe(0);
  expect(await counts(schema.soloRounds, schema.soloRounds.levelId)).toBe(0);
  expect(await counts(schema.ratings, schema.ratings.levelId)).toBe(0);
  expect(
    await counts(schema.campaignLevels, schema.campaignLevels.levelId)
  ).toBe(0);
});
