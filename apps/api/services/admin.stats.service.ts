// Admin dashboard stats service: orchestration + number coercion + derived
// rates + contiguous date-fill. The repo returns raw aggregate rows (Drizzle
// sum/count come back as strings; date buckets as Date|string); everything that
// turns those into the wire DTOs (Number(), 0..1 rates, the full day range)
// lives here so the repo stays pure Drizzle.
import type { AdminOverview, AdminTimeseriesPoint } from "@ouigame/shared/api";
import * as repo from "../repositories/admin.stats.repo";

// Drizzle aggregates (sum/count) arrive as strings or null; coerce to a number.
function n(value: unknown): number {
  return Number(value) || 0;
}

// One UTC day in milliseconds.
const DAY_MS = 24 * 60 * 60 * 1000;

// Midnight (00:00:00.000) UTC of the day containing `d`.
function utcMidnight(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

// The YYYY-MM-DD key for a date, in UTC. Used both to format the series and to
// key the per-metric Maps so they line up with the contiguous range.
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Normalize a date bucket coming back from the DB. Depending on the driver,
// date_trunc(...)::date can surface as a Date or a "YYYY-MM-DD" string.
function bucketKey(day: unknown): string {
  if (day instanceof Date) return dayKey(day);
  // Already a string like "2026-06-19" (possibly with a time/zone suffix).
  return String(day).slice(0, 10);
}

// GET /api/admin/overview — every headline metric, computed by aggregate
// queries and assembled into the flat AdminOverview bag.
async function getOverview(): Promise<AdminOverview> {
  const now = new Date();
  const today = utcMidnight(now);
  const since = {
    today,
    d7: new Date(now.getTime() - 7 * DAY_MS),
    d30: new Date(now.getTime() - 30 * DAY_MS),
  };

  const [
    pCounts,
    newP,
    activeP,
    content,
    games,
    onlineCombat,
    soloCombat,
    soloComp,
    campaignRunStats,
    achievements,
    logins,
  ] = await Promise.all([
    repo.playerCounts(),
    repo.newPlayerCounts(since),
    repo.activePlayerCounts(since),
    repo.contentCounts(),
    repo.gameCounts(),
    repo.onlineCombatTotals(),
    repo.soloCombatTotals(),
    repo.soloCompletion(),
    repo.campaignRunStats(),
    repo.achievementCount(),
    repo.loginCounts(),
  ]);

  // Content.
  const levelsTotal = n(content.levels);
  const levelsUp = n(content.levelsUp);

  // Games.
  const onlineRounds = n(games.onlineRounds);
  const soloRounds = n(games.soloRounds);
  const campaignRuns = n(games.campaignRuns);

  // Combat (online + solo summed; wins only exist on online rounds).
  const kills = n(onlineCombat.kills) + n(soloCombat.kills);
  const deaths = n(onlineCombat.deaths) + n(soloCombat.deaths);
  const shots = n(onlineCombat.shots) + n(soloCombat.shots);
  const hits = n(onlineCombat.hits) + n(soloCombat.hits);
  const plants = n(onlineCombat.plants) + n(soloCombat.plants);
  const blocksDestroyed =
    n(onlineCombat.blocksDestroyed) + n(soloCombat.blocksDestroyed);
  const wins = n(onlineCombat.wins);

  // Solo completion.
  const completions = n(soloComp.completions);
  const attempts = n(soloComp.attempts);

  // Campaign runs.
  const cRuns = n(campaignRunStats.runs);
  const cCompletions = n(campaignRunStats.completions);

  // Logins.
  const loginSuccess = n(logins.success);
  const loginFailed = n(logins.failed);

  return {
    players: {
      total: n(pCounts.total),
      db: n(pCounts.db),
      google: n(pCounts.google),
      admins: n(pCounts.admins),
      newToday: n(newP.newToday),
      new7d: n(newP.new7d),
      new30d: n(newP.new30d),
      activeToday: n(activeP.activeToday),
      active7d: n(activeP.active7d),
      active30d: n(activeP.active30d),
    },
    content: {
      levels: levelsTotal,
      levelsUp,
      levelsDown: levelsTotal - levelsUp,
      campaigns: n(content.campaigns),
      ratings: n(content.ratings),
    },
    games: {
      onlineRounds,
      soloRounds,
      campaignRuns,
      total: onlineRounds + soloRounds + campaignRuns,
    },
    combat: {
      kills,
      deaths,
      wins,
      shots,
      hits,
      accuracy: shots > 0 ? hits / shots : 0,
      blocksDestroyed,
      plants,
    },
    solo: {
      completions,
      attempts,
      completionRate: attempts > 0 ? completions / attempts : 0,
      distinctLevelsCompleted: n(soloComp.distinctLevelsCompleted),
    },
    campaignsStats: {
      runs: cRuns,
      completions: cCompletions,
      completionRate: cRuns > 0 ? cCompletions / cRuns : 0,
    },
    achievements: {
      unlocked: n(achievements.unlocked),
    },
    logins: {
      total: n(logins.total),
      success: loginSuccess,
      failed: loginFailed,
      successRate:
        loginSuccess + loginFailed > 0
          ? loginSuccess / (loginSuccess + loginFailed)
          : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

// Collapse grouped rows ({ day, value }) into a YYYY-MM-DD → number Map.
function toMap(rows: { day: unknown; value: unknown }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(bucketKey(row.day), n(row.value));
  }
  return map;
}

// GET /api/admin/timeseries?days= — a CONTIGUOUS daily series of the last
// `days` days ending today (UTC), oldest first, every missing day filled with
// 0. Each metric is a single grouped query; assembly walks the full date range.
async function getTimeseries(days: number): Promise<AdminTimeseriesPoint[]> {
  const today = utcMidnight(new Date());
  // The window covers `days` days ending today inclusive, so the first day is
  // (days - 1) days before today.
  const start = new Date(today.getTime() - (days - 1) * DAY_MS);

  const [
    newUsers,
    activeUsers,
    logins,
    failedLogins,
    onlineRounds,
    soloRounds,
    campaignRuns,
    onlineKills,
    soloKills,
    levelsCreated,
  ] = await Promise.all([
    repo.newUsersByDay(start),
    repo.activeUsersByDay(start),
    repo.loginsByDay(start),
    repo.failedLoginsByDay(start),
    repo.onlineRoundsByDay(start),
    repo.soloRoundsByDay(start),
    repo.campaignRunsByDay(start),
    repo.onlineKillsByDay(start),
    repo.soloKillsByDay(start),
    repo.levelsCreatedByDay(start),
  ]);

  const newUsersMap = toMap(newUsers);
  const activeUsersMap = toMap(activeUsers);
  const loginsMap = toMap(logins);
  const failedLoginsMap = toMap(failedLogins);
  const onlineRoundsMap = toMap(onlineRounds);
  const soloRoundsMap = toMap(soloRounds);
  const campaignRunsMap = toMap(campaignRuns);
  const onlineKillsMap = toMap(onlineKills);
  const soloKillsMap = toMap(soloKills);
  const levelsCreatedMap = toMap(levelsCreated);

  const series: AdminTimeseriesPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = dayKey(new Date(start.getTime() + i * DAY_MS));
    const online = onlineRoundsMap.get(date) ?? 0;
    const solo = soloRoundsMap.get(date) ?? 0;
    const campaign = campaignRunsMap.get(date) ?? 0;
    series.push({
      date,
      newUsers: newUsersMap.get(date) ?? 0,
      activeUsers: activeUsersMap.get(date) ?? 0,
      logins: loginsMap.get(date) ?? 0,
      failedLogins: failedLoginsMap.get(date) ?? 0,
      onlineRounds: online,
      soloRounds: solo,
      campaignRuns: campaign,
      games: online + solo + campaign,
      kills: (onlineKillsMap.get(date) ?? 0) + (soloKillsMap.get(date) ?? 0),
      levelsCreated: levelsCreatedMap.get(date) ?? 0,
    });
  }
  return series;
}

export { getOverview, getTimeseries };
