// Pure Drizzle queries for the levels domain. NO req/res, NO socket, NO
// business rules — just data access. Row shapes are kept byte-for-byte
// identical to the old inline route queries (same selected columns/aliases,
// same WHERE/GROUP BY/ORDER BY) so formatting downstream is unchanged.
import { db, schema } from "@ouigame/db";
import { eq, like, and, sql, desc, inArray, min, max } from "drizzle-orm";

const { levels, levelsImg, ratings } = schema;

// List "up" levels of a given type, filtered by name substring + optional
// max-players, with the averaged rating, ordered by rating descending.
async function list({
  name,
  type,
  maxPlayers,
}: {
  name: string;
  type: string;
  maxPlayers: number;
}) {
  return db
    .select({
      id: levels.id,
      name: levels.name,
      content: levels.content,
      creatorId: levels.creatorId,
      maxPlayers: levels.maxPlayers,
      type: levels.type,
      status: levels.status,
      rating: sql`COALESCE(AVG(${ratings.stars}), 0)`.as("rating"),
    })
    .from(levels)
    .leftJoin(ratings, eq(levels.id, ratings.levelId))
    .where(
      and(
        like(levels.name, sql`'%' || ${name} || '%'`),
        eq(levels.type, type),
        eq(levels.status, "up"),
        maxPlayers !== 0 ? eq(levels.maxPlayers, maxPlayers) : undefined
      )
    )
    .groupBy(levels.id)
    .orderBy(desc(sql`rating`));
}

// List the "up" levels owned by a given player, ordered by rating ascending.
async function listMine({
  name,
  playerId,
  maxPlayers,
}: {
  name: string;
  playerId: number;
  maxPlayers: number;
}) {
  return db
    .select({
      id: levels.id,
      name: levels.name,
      content: levels.content,
      creatorId: levels.creatorId,
      maxPlayers: levels.maxPlayers,
      rating: sql`COALESCE(AVG(${ratings.stars}), 0)`.as("rating"),
    })
    .from(levels)
    .leftJoin(ratings, eq(levels.id, ratings.levelId))
    .where(
      and(
        like(levels.name, sql`'%' || ${name} || '%'`),
        eq(levels.creatorId, playerId),
        eq(levels.status, "up"),
        maxPlayers !== 0 ? eq(levels.maxPlayers, maxPlayers) : undefined
      )
    )
    .groupBy(levels.id)
    .orderBy(sql`rating`);
}

// One level with its averaged rating (same shape as the list rows minus status).
async function selectById(levelId: number) {
  return db
    .select({
      id: levels.id,
      name: levels.name,
      content: levels.content,
      creatorId: levels.creatorId,
      maxPlayers: levels.maxPlayers,
      type: levels.type,
      rating: sql`COALESCE(AVG(${ratings.stars}), 0)`.as("rating"),
    })
    .from(levels)
    .leftJoin(ratings, eq(levels.id, ratings.levelId))
    .where(eq(levels.id, levelId))
    .groupBy(levels.id);
}

// Raw level content row (id/name/content/creatorId) for the JSON payload.
async function selectContentById(levelId: number) {
  return db
    .select({
      id: levels.id,
      name: levels.name,
      content: levels.content,
      creatorId: levels.creatorId,
    })
    .from(levels)
    .where(eq(levels.id, levelId));
}

// Insert a level row, returning its new id.
async function insertLevel({
  name,
  content,
  creatorId,
  maxPlayers,
  type,
}: {
  name: string;
  content: unknown;
  creatorId: number;
  maxPlayers: number;
  type: string;
}) {
  return db
    .insert(levels)
    .values({
      name,
      content,
      creatorId,
      maxPlayers,
      type,
      status: "up",
    })
    .returning({ id: levels.id });
}

// Update a level owned by the given player (scoped by id + creatorId).
async function updateLevel(
  levelId: number,
  playerId: number,
  {
    name,
    content,
    maxPlayers,
    type,
  }: { name: string; content: unknown; maxPlayers: number; type: string }
) {
  return db
    .update(levels)
    .set({
      name,
      content,
      maxPlayers,
      type,
      status: "up",
    })
    .where(and(eq(levels.id, levelId), eq(levels.creatorId, playerId)));
}

// Insert the image row for a level.
async function insertLevelImg(levelId: number, hexData: string) {
  return db.insert(levelsImg).values({
    levelId,
    img: Buffer.from(hexData, "hex"),
  });
}

// Replace the image bytes of an existing level.
async function updateLevelImg(levelId: number, hexData: string) {
  return db
    .update(levelsImg)
    .set({ img: Buffer.from(hexData, "hex") })
    .where(eq(levelsImg.levelId, levelId));
}

// Rows for a level only if it is owned by the given player (ownership probe).
async function selectLevelOwnedBy(levelId: number, playerId: number) {
  return db
    .select()
    .from(levels)
    .where(and(eq(levels.id, levelId), eq(levels.creatorId, playerId)));
}

// Delete a level by id. Child rows are removed by ON DELETE CASCADE.
async function deleteLevel(levelId: number) {
  return db.delete(levels).where(eq(levels.id, levelId));
}

// Min/max max-players across a set of level ids.
async function getMinMaxPlayers(levelIds: number[]) {
  const res = await db
    .select({ min: min(levels.maxPlayers), max: max(levels.maxPlayers) })
    .from(levels)
    .where(inArray(levels.id, levelIds));
  return { min: res[0]?.min, max: res[0]?.max };
}

export {
  list,
  listMine,
  selectById,
  selectContentById,
  insertLevel,
  updateLevel,
  insertLevelImg,
  updateLevelImg,
  selectLevelOwnedBy,
  deleteLevel,
  getMinMaxPlayers,
};
