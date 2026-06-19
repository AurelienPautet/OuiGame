// Admin users service: orchestration + business rules for the admin user
// table. Coerces the repository's raw aggregate columns (Drizzle SUM/COUNT come
// back as strings) to plain numbers, turns Date columns into ISO strings, and
// shapes the AdminUserListItem / AdminUserDetail wire DTOs. Mutations
// (promote/demote, delete) are recorded in the audit log by the caller path.
import type {
  AdminUserListItem,
  AdminUserDetail,
  AdminUsersResponse,
} from "@ouigame/shared/api";
import * as repo from "../repositories/admin.users.repo";

// Normalize a timestamp coming back from Drizzle to an ISO string. Mapped
// timestamp columns arrive as Date, but raw SQL aggregates (e.g. MAX(...)) come
// back as a string — accept both (and null) so callers never crash on
// `.toISOString()`.
function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

// Shape one raw list-item row (string/Date aggregate columns) into the wire
// AdminUserListItem (plain numbers, ISO strings, nullable lastLoginAt).
function toListItem(row: {
  id: number;
  username: string;
  email: string;
  type: string;
  isAdmin: boolean;
  createdAt: Date | string | null;
  lastLoginAt: Date | string | null;
  onlineRounds: unknown;
  soloRounds: unknown;
  kills: unknown;
  wins: unknown;
  levelsCreated: unknown;
  campaignsCreated: unknown;
  achievements: unknown;
}): AdminUserListItem {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    type: row.type,
    isAdmin: row.isAdmin,
    createdAt: toIso(row.createdAt) ?? "",
    lastLoginAt: toIso(row.lastLoginAt),
    onlineRounds: Number(row.onlineRounds) || 0,
    soloRounds: Number(row.soloRounds) || 0,
    kills: Number(row.kills) || 0,
    wins: Number(row.wins) || 0,
    levelsCreated: Number(row.levelsCreated) || 0,
    campaignsCreated: Number(row.campaignsCreated) || 0,
    achievements: Number(row.achievements) || 0,
  };
}

// Paginated, filtered, sorted user list. `sort`/`order` default to
// created/desc; page/pageSize defaults are applied by the route.
async function listUsers(params: {
  search: string | undefined;
  type: string | undefined;
  sort: string;
  order: "asc" | "desc";
  page: number;
  pageSize: number;
}): Promise<AdminUsersResponse> {
  const { search, type, sort, order, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    repo.listUsers({ search, type, sort, order, limit: pageSize, offset }),
    repo.countUsers({ search, type }),
  ]);

  return {
    users: rows.map(toListItem),
    total,
    page,
    pageSize,
  };
}

// Full profile for one user, or null if no such player.
async function getUserDetail(id: number): Promise<AdminUserDetail | null> {
  const base = await repo.getUserListItem(id);
  if (base === undefined) return null;

  const [combat, campaignRunsCount, recentLogins, levels, campaigns, keys] =
    await Promise.all([
      repo.getCombatTotals(id),
      repo.countCampaignRuns(id),
      repo.getRecentLogins(id, 20),
      repo.getCreatedLevels(id),
      repo.getCreatedCampaigns(id),
      repo.getAchievementKeys(id),
    ]);

  const deaths =
    (Number(combat.online.onlineDeaths) || 0) +
    (Number(combat.solo.soloDeaths) || 0);
  const shots =
    (Number(combat.online.onlineShots) || 0) +
    (Number(combat.solo.soloShots) || 0);
  const hits =
    (Number(combat.online.onlineHits) || 0) +
    (Number(combat.solo.soloHits) || 0);
  const blocksDestroyed =
    (Number(combat.online.onlineBlocks) || 0) +
    (Number(combat.solo.soloBlocks) || 0);
  const soloCompletions = Number(combat.solo.soloCompletions) || 0;

  return {
    ...toListItem(base),
    deaths,
    shots,
    hits,
    accuracy: shots > 0 ? hits / shots : 0,
    blocksDestroyed,
    soloCompletions,
    campaignRuns: campaignRunsCount,
    recentLogins: recentLogins.map((l) => ({
      ip: l.ip,
      status: l.status,
      at: l.at ? l.at.toISOString() : "",
    })),
    levels: levels.map((lvl) => ({
      id: lvl.id,
      name: lvl.name,
      status: lvl.status,
      type: lvl.type,
      createdAt: lvl.createdAt ? lvl.createdAt.toISOString() : "",
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt ? c.createdAt.toISOString() : "",
    })),
    achievements: keys,
  };
}

// Existence probe + username, for the route guards / audit details.
async function findPlayer(id: number) {
  return repo.findPlayer(id);
}

// Set the is_admin flag, then re-fetch the updated user in list-item shape.
async function setIsAdmin(
  id: number,
  isAdmin: boolean
): Promise<AdminUserListItem> {
  await repo.setIsAdmin(id, isAdmin);
  const updated = await repo.getUserListItem(id);
  // The caller has already verified the player exists, so this is always set.
  return toListItem(updated!);
}

async function deletePlayer(id: number): Promise<void> {
  await repo.deletePlayer(id);
}

export { listUsers, getUserDetail, findPlayer, setIsAdmin, deletePlayer };
