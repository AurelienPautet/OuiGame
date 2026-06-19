// Admin users data access — PURE Drizzle queries (no req/res, no business
// rules). The list query carries per-user aggregates as scalar correlated
// subqueries so the chosen sort (kills/wins/rounds/levels/...) orders across
// ALL matching users before the LIMIT/OFFSET page is taken. The service
// coerces the (string) aggregate columns to numbers and shapes the wire DTOs.
import { db, schema } from "@ouigame/db";
import { eq, and, or, sql, count, desc, asc, ilike } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

const {
  players,
  levels,
  campaigns,
  campaignRuns,
  rounds,
  soloRounds,
  logings,
  playerAchievements,
} = schema;

// The outer `players.id` reference used to correlate the subqueries below.
// IMPORTANT: a bare `${players.id}` renders as the *unqualified* identifier
// "id". Inside a subquery whose FROM table (e.g. rounds/levels) also owns an
// "id" column, Postgres binds that unqualified "id" to the INNER table — so the
// correlation silently becomes `inner.player_id = inner.id` and always counts
// 0. Qualifying it as "OuiTank-players"."id" forces the outer-row reference.
const playersId = sql`${players}.${sql.identifier("id")}`;

// Per-user aggregate subqueries. Each is a scalar correlated subquery against
// the current `players` row, wrapped in COALESCE so a user with no related
// rows reads 0 (and so ORDER BY never sorts NULLs).
const onlineRoundsExpr =
  sql<number>`(SELECT COUNT(*) FROM ${rounds} WHERE ${rounds.playerId} = ${playersId})`.as(
    "online_rounds"
  );
const soloRoundsExpr =
  sql<number>`(SELECT COUNT(*) FROM ${soloRounds} WHERE ${soloRounds.playerId} = ${playersId})`.as(
    "solo_rounds"
  );
const killsExpr =
  sql<number>`(COALESCE((SELECT SUM(${rounds.kills}) FROM ${rounds} WHERE ${rounds.playerId} = ${playersId}), 0) + COALESCE((SELECT SUM(${soloRounds.kills}) FROM ${soloRounds} WHERE ${soloRounds.playerId} = ${playersId}), 0))`.as(
    "kills"
  );
const winsExpr =
  sql<number>`COALESCE((SELECT SUM(${rounds.wins}) FROM ${rounds} WHERE ${rounds.playerId} = ${playersId}), 0)`.as(
    "wins"
  );
const levelsCreatedExpr =
  sql<number>`(SELECT COUNT(*) FROM ${levels} WHERE ${levels.creatorId} = ${playersId})`.as(
    "levels_created"
  );
const campaignsCreatedExpr =
  sql<number>`(SELECT COUNT(*) FROM ${campaigns} WHERE ${campaigns.creatorId} = ${playersId})`.as(
    "campaigns_created"
  );
const achievementsExpr =
  sql<number>`(SELECT COUNT(*) FROM ${playerAchievements} WHERE ${playerAchievements.playerId} = ${playersId})`.as(
    "achievements"
  );
const lastLoginAtExpr =
  sql<Date | null>`(SELECT MAX(${logings.attemptTimestamp}) FROM ${logings} WHERE ${logings.playerId} = ${playersId} AND ${logings.status} ILIKE '%success%')`.as(
    "last_login_at"
  );

// The list-item row shape (raw aggregates are strings/Dates; the service
// coerces them).
const listItemColumns = {
  id: players.id,
  username: players.username,
  email: players.email,
  type: players.type,
  isAdmin: players.isAdmin,
  createdAt: players.creationTimestamp,
  lastLoginAt: lastLoginAtExpr,
  onlineRounds: onlineRoundsExpr,
  soloRounds: soloRoundsExpr,
  kills: killsExpr,
  wins: winsExpr,
  levelsCreated: levelsCreatedExpr,
  campaignsCreated: campaignsCreatedExpr,
  achievements: achievementsExpr,
};

// Build the WHERE clause shared by the page query and the total count, so both
// see the same search/type filter.
function buildFilter(search: string | undefined, type: string | undefined) {
  const conditions: (SQL | undefined)[] = [];
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(players.username, pattern), ilike(players.email, pattern))
    );
  }
  if (type) {
    conditions.push(eq(players.type, type));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

// Map the requested sort key to its ORDER BY expression. `created` falls back
// to creationTimestamp; the aggregate keys reference the named subqueries.
function sortExpr(sort: string): SQL {
  switch (sort) {
    case "username":
      return sql`${players.username}`;
    case "kills":
      return sql`kills`;
    case "wins":
      return sql`wins`;
    case "rounds":
      return sql`(online_rounds + solo_rounds)`;
    case "levels":
      return sql`levels_created`;
    case "created":
    default:
      return sql`${players.creationTimestamp}`;
  }
}

// One page of users (list-item shape) matching the search/type filter, ordered
// by the chosen aggregate/column across ALL matching users, then paginated.
async function listUsers({
  search,
  type,
  sort,
  order,
  limit,
  offset,
}: {
  search: string | undefined;
  type: string | undefined;
  sort: string;
  order: "asc" | "desc";
  limit: number;
  offset: number;
}) {
  const expr = sortExpr(sort);
  return db
    .select(listItemColumns)
    .from(players)
    .where(buildFilter(search, type))
    .orderBy(order === "asc" ? asc(expr) : desc(expr))
    .limit(limit)
    .offset(offset);
}

// Total count of users matching the search/type filter (not just the page).
async function countUsers({
  search,
  type,
}: {
  search: string | undefined;
  type: string | undefined;
}) {
  const rows = await db
    .select({ total: count() })
    .from(players)
    .where(buildFilter(search, type));
  // count() with no GROUP BY always yields exactly one row.
  return Number(rows[0]!.total) || 0;
}

// A single user's list-item row (same aggregate shape as the list), or
// undefined if no such player.
async function getUserListItem(id: number) {
  const rows = await db
    .select(listItemColumns)
    .from(players)
    .where(eq(players.id, id));
  return rows[0];
}

// Deeper combat totals for one user (rounds + solo rounds), always one row.
async function getCombatTotals(id: number) {
  const rows = await db
    .select({
      onlineDeaths: sql<string | null>`SUM(${rounds.deaths})`,
      onlineShots: sql<string | null>`SUM(${rounds.shots})`,
      onlineHits: sql<string | null>`SUM(${rounds.hits})`,
      onlineBlocks: sql<string | null>`SUM(${rounds.blocksDestroyed})`,
    })
    .from(rounds)
    .where(eq(rounds.playerId, id));
  const soloRows = await db
    .select({
      soloDeaths: sql<string | null>`SUM(${soloRounds.deaths})`,
      soloShots: sql<string | null>`SUM(${soloRounds.shots})`,
      soloHits: sql<string | null>`SUM(${soloRounds.hits})`,
      soloBlocks: sql<string | null>`SUM(${soloRounds.blocksDestroyed})`,
      soloCompletions: sql<string>`COUNT(*) FILTER (WHERE ${soloRounds.success})`,
    })
    .from(soloRounds)
    .where(eq(soloRounds.playerId, id));
  return { online: rows[0]!, solo: soloRows[0]! };
}

// Number of campaign runs by this user.
async function countCampaignRuns(id: number) {
  const rows = await db
    .select({ total: count() })
    .from(campaignRuns)
    .where(eq(campaignRuns.playerId, id));
  return Number(rows[0]!.total) || 0;
}

// The user's most recent login attempts, newest first.
async function getRecentLogins(id: number, limit: number) {
  return db
    .select({
      ip: logings.ipAddress,
      status: logings.status,
      at: logings.attemptTimestamp,
    })
    .from(logings)
    .where(eq(logings.playerId, id))
    .orderBy(desc(logings.attemptTimestamp))
    .limit(limit);
}

// Levels this user created, newest first.
async function getCreatedLevels(id: number) {
  return db
    .select({
      id: levels.id,
      name: levels.name,
      status: levels.status,
      type: levels.type,
      createdAt: levels.creationTimestamp,
    })
    .from(levels)
    .where(eq(levels.creatorId, id))
    .orderBy(desc(levels.creationTimestamp));
}

// Campaigns this user created, newest first.
async function getCreatedCampaigns(id: number) {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      createdAt: campaigns.creationTimestamp,
    })
    .from(campaigns)
    .where(eq(campaigns.creatorId, id))
    .orderBy(desc(campaigns.creationTimestamp));
}

// The achievement keys this user has unlocked.
async function getAchievementKeys(id: number) {
  const rows = await db
    .select({ key: playerAchievements.achievementKey })
    .from(playerAchievements)
    .where(eq(playerAchievements.playerId, id));
  return rows.map((r) => r.key);
}

// Existence probe: the player row (id only) for this id, or undefined.
async function findPlayer(id: number) {
  const rows = await db
    .select({ id: players.id, username: players.username })
    .from(players)
    .where(eq(players.id, id));
  return rows[0];
}

// Set the is_admin flag on a player.
async function setIsAdmin(id: number, isAdmin: boolean) {
  await db.update(players).set({ isAdmin }).where(eq(players.id, id));
}

// Delete a player. Child rows cascade / SET NULL per the schema FK rules.
async function deletePlayer(id: number) {
  await db.delete(players).where(eq(players.id, id));
}

export {
  listUsers,
  countUsers,
  getUserListItem,
  getCombatTotals,
  countCampaignRuns,
  getRecentLogins,
  getCreatedLevels,
  getCreatedCampaigns,
  getAchievementKeys,
  findPlayer,
  setIsAdmin,
  deletePlayer,
};
