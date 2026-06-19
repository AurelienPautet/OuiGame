// Admin content domain repository — PURE Drizzle queries for the level catalog
// and campaign catalog the admin dashboard moderates. No req/res, no business
// rules; the service coerces aggregate counts/averages to plain numbers and
// serializes dates to ISO strings. Levels/campaigns LEFT-JOIN players for the
// (nullable) creator name so a row survives even after its creator is removed.
import { db, schema } from "@ouigame/db";
import { and, asc, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";

const {
  levels,
  campaigns,
  campaignLevels,
  campaignRuns,
  ratings,
  rounds,
  soloRounds,
  players,
} = schema;

// Outer-row references for the correlated subqueries below. A bare
// `${levels.id}` / `${campaigns.id}` renders as the *unqualified* identifier
// "id"; inside a subquery whose FROM table also owns an "id" column, Postgres
// binds that "id" to the INNER table, breaking the correlation (it would always
// match the inner row's own id). Qualifying with the table name forces the
// outer reference.
const levelsId = sql`${levels}.${sql.identifier("id")}`;
const campaignsId = sql`${campaigns}.${sql.identifier("id")}`;

// --- Levels -----------------------------------------------------------------

// Build the WHERE for the level list: optional case-insensitive name substring
// match AND an optional status filter (up/down). Returns undefined when there
// are no filters (list everything).
function levelsWhere(search: string | undefined, status: string | undefined) {
  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(levels.name, `%${search}%`));
  if (status) conditions.push(eq(levels.status, status));
  if (conditions.length === 0) return undefined;
  return and(...conditions);
}

// One page of levels matching the filter, each with the (nullable) creator name
// resolved via LEFT JOIN, the online+solo play count, and the averaged rating
// plus rating count. `orderBy` is the sort expression the service built. Plays
// and rating aggregates are correlated subqueries so the LEFT JOIN on players
// (a single row) keeps each level on exactly one output row.
async function listLevels(
  where: SQL | undefined,
  orderBy: SQL,
  limit: number,
  offset: number
) {
  return db
    .select({
      id: levels.id,
      name: levels.name,
      type: levels.type,
      status: levels.status,
      maxPlayers: levels.maxPlayers,
      creatorName: players.username,
      createdAt: levels.creationTimestamp,
      plays: sql<string>`(
        (SELECT COUNT(*) FROM ${rounds} WHERE ${rounds.levelId} = ${levelsId})
        + (SELECT COUNT(*) FROM ${soloRounds} WHERE ${soloRounds.levelId} = ${levelsId})
      )`,
      rating: sql<
        string | null
      >`(SELECT AVG(${ratings.stars}) FROM ${ratings} WHERE ${ratings.levelId} = ${levelsId})`,
      ratingCount: sql<string>`(SELECT COUNT(*) FROM ${ratings} WHERE ${ratings.levelId} = ${levelsId})`,
    })
    .from(levels)
    .leftJoin(players, eq(levels.creatorId, players.id))
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);
}

// Total levels matching the same filter (the pagination denominator).
async function countLevels(where: SQL | undefined) {
  const rows = await db.select({ total: count() }).from(levels).where(where);
  // count() with no GROUP BY always yields exactly one row.
  return rows[0]!.total;
}

// Build the ORDER BY for the level list from the validated sort + order. Plays
// and rating are the same correlated subqueries used in the SELECT.
function levelsOrderBy(
  sort: string | undefined,
  order: string | undefined
): SQL {
  const dir = order === "asc" ? asc : desc;
  switch (sort) {
    case "plays":
      return dir(sql`(
        (SELECT COUNT(*) FROM ${rounds} WHERE ${rounds.levelId} = ${levelsId})
        + (SELECT COUNT(*) FROM ${soloRounds} WHERE ${soloRounds.levelId} = ${levelsId})
      )`);
    case "rating":
      return dir(
        sql`(SELECT AVG(${ratings.stars}) FROM ${ratings} WHERE ${ratings.levelId} = ${levelsId})`
      );
    case "name":
      return dir(levels.name);
    case "created":
    default:
      return dir(levels.creationTimestamp);
  }
}

// A level's id/name/status (existence probe for PATCH/DELETE). Array, empty if
// not found.
async function getLevelById(levelId: number) {
  return db
    .select({ id: levels.id, name: levels.name, status: levels.status })
    .from(levels)
    .where(eq(levels.id, levelId));
}

// Moderate a level: set its status. Children are untouched.
async function setLevelStatus(levelId: number, status: string) {
  await db.update(levels).set({ status }).where(eq(levels.id, levelId));
}

// Delete a level by id. Child rows (image, ratings, rounds, solo rounds,
// campaign-level links) are removed by ON DELETE CASCADE in the schema.
async function deleteLevel(levelId: number) {
  await db.delete(levels).where(eq(levels.id, levelId));
}

// --- Campaigns --------------------------------------------------------------

// Build the WHERE for the campaign list: optional case-insensitive name
// substring match. undefined when there is no search.
function campaignsWhere(search: string | undefined) {
  if (!search) return undefined;
  return ilike(campaigns.name, `%${search}%`);
}

// One page of campaigns matching the filter (newest first), each with the
// (nullable) creator name resolved via LEFT JOIN, the level count, run count,
// and completion count. The aggregates are correlated subqueries so the LEFT
// JOIN on players keeps each campaign on exactly one output row.
async function listCampaigns(
  where: SQL | undefined,
  limit: number,
  offset: number
) {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      creatorName: players.username,
      createdAt: campaigns.creationTimestamp,
      levelCount: sql<string>`(SELECT COUNT(*) FROM ${campaignLevels} WHERE ${campaignLevels.campaignId} = ${campaignsId})`,
      runs: sql<string>`(SELECT COUNT(*) FROM ${campaignRuns} WHERE ${campaignRuns.campaignId} = ${campaignsId})`,
      completions: sql<string>`(SELECT COUNT(*) FROM ${campaignRuns} WHERE ${campaignRuns.campaignId} = ${campaignsId} AND ${campaignRuns.completed})`,
    })
    .from(campaigns)
    .leftJoin(players, eq(campaigns.creatorId, players.id))
    .where(where)
    .orderBy(desc(campaigns.creationTimestamp))
    .limit(limit)
    .offset(offset);
}

// Total campaigns matching the same filter (the pagination denominator).
async function countCampaigns(where: SQL | undefined) {
  const rows = await db.select({ total: count() }).from(campaigns).where(where);
  return rows[0]!.total;
}

// A campaign's id/name (existence probe for DELETE). Array, empty if not found.
async function getCampaignById(campaignId: number) {
  return db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
}

// Delete a campaign by id. Runs and campaign-level links are removed by ON
// DELETE CASCADE in the schema.
async function deleteCampaign(campaignId: number) {
  await db.delete(campaigns).where(eq(campaigns.id, campaignId));
}

export {
  levelsWhere,
  levelsOrderBy,
  listLevels,
  countLevels,
  getLevelById,
  setLevelStatus,
  deleteLevel,
  campaignsWhere,
  listCampaigns,
  countCampaigns,
  getCampaignById,
  deleteCampaign,
};
