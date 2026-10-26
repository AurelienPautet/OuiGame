// Admin dashboard stats service: orchestration + number coercion + derived
// rates + contiguous date-fill. The repo returns raw aggregate rows (Drizzle
// sum/count come back as strings; date buckets as Date|string); everything that
// turns those into the wire DTOs (Number(), 0..1 rates, the full day range)
// lives here so the repo stays pure Drizzle.
import type {
  AdminOverview,
  AdminTimeseriesPoint,
  AdminTimeseriesQuery,
} from "@ouigame/shared/api";
import * as repo from "../repositories/admin.stats.repo";
import * as dailyActivityRepo from "../repositories/dailyActivity.repo";
import * as playSessions from "../socket/playSessions";

// Drizzle aggregates (sum/count) arrive as strings or null; coerce to a number.
function n(value: unknown): number {
  return Number(value) || 0;
}

// One UTC day in milliseconds.
const DAY_MS = 24 * 60 * 60 * 1000;
// One hour in milliseconds.
const HOUR_MS = 60 * 60 * 1000;

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

function formatHourKey(d: Date): string {
  const pad = (num: number) => String(num).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  return `${y}-${m}-${day} ${h}:00`;
}

function hourLabel(d: Date): string {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${pad(d.getUTCHours())}:00`;
}

// Normalize a date/hour bucket coming back from the DB.
function bucketKey(val: unknown, granularity: "day" | "hour" = "day"): string {
  if (granularity === "hour") {
    if (val instanceof Date) return formatHourKey(val);
    return String(val ?? "").slice(0, 16);
  }
  if (val instanceof Date) return dayKey(val);
  return String(val ?? "").slice(0, 10);
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
    activeVisitors,
    content,
    games,
    onlineCombat,
    soloCombat,
    playtime,
    soloComp,
    campaignRunStats,
    achievements,
    logins,
  ] = await Promise.all([
    repo.playerCounts(),
    repo.newPlayerCounts(since),
    repo.activePlayerCounts(since),
    dailyActivityRepo.activeVisitorCounts({
      today: dayKey(today),
      d7: dayKey(since.d7),
      d30: dayKey(since.d30),
    }),
    repo.contentCounts(),
    repo.gameCounts(),
    repo.onlineCombatTotals(),
    repo.soloCombatTotals(),
    repo.playtimeTotals(),
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

  // Playtime: solo + online level time is "time played"; session time is the
  // wider connected-time metric (includes menus and lobby), and adds the
  // sessions that are still open so the dashboard is live.
  const soloMs = n(playtime.soloMs);
  const onlineMs = n(playtime.onlineMs);
  const sessionMs = n(playtime.sessionMs) + playSessions.totalActiveSessionMs();

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
      activeToday: Math.max(
        n(activeVisitors.activeToday),
        n(activeP.activeToday)
      ),
      active7d: Math.max(n(activeVisitors.active7d), n(activeP.active7d)),
      active30d: Math.max(n(activeVisitors.active30d), n(activeP.active30d)),
      guestsToday: n(activeVisitors.guestsToday),
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
    playtime: {
      soloMs,
      onlineMs,
      sessionMs,
      totalMs: soloMs + onlineMs,
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

// Collapse grouped rows into a bucketKey → number Map.
function toMap(
  rows: { day?: unknown; hour?: unknown; key?: unknown; value: unknown }[],
  granularity: "day" | "hour" = "day"
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const raw = row.hour ?? row.day ?? row.key;
    map.set(bucketKey(raw, granularity), n(row.value));
  }
  return map;
}

// GET /api/admin/timeseries?range=24h — a CONTIGUOUS hourly series of the last
// 24 hours ending at current hour (UTC), oldest first, missing hours filled with 0.
async function getHourlyTimeseries(): Promise<AdminTimeseriesPoint[]> {
  const now = new Date();
  const currentHour = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      0,
      0,
      0
    )
  );
  // Last 24 hours ending at currentHour (24 hourly buckets: from now - 23h to now)
  const start = new Date(currentHour.getTime() - 23 * HOUR_MS);

  const [
    newUsers,
    activeUsers,
    dailyActivity,
    logins,
    failedLogins,
    onlineRounds,
    soloRounds,
    campaignRuns,
    onlineKills,
    soloKills,
    levelsCreated,
  ] = await Promise.all([
    repo.newUsersSeries(start, "hour"),
    repo.activeUsersSeries(start, "hour"),
    dailyActivityRepo.activityByHour(start),
    repo.loginsSeries(start, "hour"),
    repo.failedLoginsSeries(start, "hour"),
    repo.onlineRoundsSeries(start, "hour"),
    repo.soloRoundsSeries(start, "hour"),
    repo.campaignRunsSeries(start, "hour"),
    repo.onlineKillsSeries(start, "hour"),
    repo.soloKillsSeries(start, "hour"),
    repo.levelsCreatedSeries(start, "hour"),
  ]);

  const newUsersMap = toMap(newUsers, "hour");
  const activeUsersMap = toMap(activeUsers, "hour");
  const loginsMap = toMap(logins, "hour");
  const failedLoginsMap = toMap(failedLogins, "hour");
  const onlineRoundsMap = toMap(onlineRounds, "hour");
  const soloRoundsMap = toMap(soloRounds, "hour");
  const campaignRunsMap = toMap(campaignRuns, "hour");
  const onlineKillsMap = toMap(onlineKills, "hour");
  const soloKillsMap = toMap(soloKills, "hour");
  const levelsCreatedMap = toMap(levelsCreated, "hour");

  const dailyActivityMap = new Map<
    string,
    { total: number; guests: number; registered: number }
  >();
  for (const row of dailyActivity) {
    dailyActivityMap.set(bucketKey(row.hour, "hour"), {
      total: n(row.total),
      guests: n(row.guests),
      registered: n(row.registered),
    });
  }

  const series: AdminTimeseriesPoint[] = [];
  for (let i = 0; i < 24; i += 1) {
    const d = new Date(start.getTime() + i * HOUR_MS);
    const key = formatHourKey(d);
    const date = hourLabel(d);

    const online = onlineRoundsMap.get(key) ?? 0;
    const solo = soloRoundsMap.get(key) ?? 0;
    const campaign = campaignRunsMap.get(key) ?? 0;

    const da = dailyActivityMap.get(key);
    const legacy = activeUsersMap.get(key) ?? 0;
    const activeGuests = da ? da.guests : 0;
    const activeRegistered = Math.max(da ? da.registered : 0, legacy);
    const totalActive = activeGuests + activeRegistered;

    series.push({
      date,
      newUsers: newUsersMap.get(key) ?? 0,
      activeUsers: totalActive,
      activeGuests,
      activeRegistered,
      logins: loginsMap.get(key) ?? 0,
      failedLogins: failedLoginsMap.get(key) ?? 0,
      onlineRounds: online,
      soloRounds: solo,
      campaignRuns: campaign,
      games: online + solo + campaign,
      kills: (onlineKillsMap.get(key) ?? 0) + (soloKillsMap.get(key) ?? 0),
      levelsCreated: levelsCreatedMap.get(key) ?? 0,
    });
  }

  return series;
}

// GET /api/admin/timeseries?days=&range= — a CONTIGUOUS series ending today (UTC),
// oldest first, every missing day/hour filled with 0.
async function getTimeseries(
  queryOrDays: AdminTimeseriesQuery | number = 30
): Promise<AdminTimeseriesPoint[]> {
  if (typeof queryOrDays === "object" && queryOrDays.range === "24h") {
    return getHourlyTimeseries();
  }
  const days =
    typeof queryOrDays === "number"
      ? queryOrDays
      : queryOrDays.range
        ? parseInt(queryOrDays.range, 10)
        : (queryOrDays.days ?? 30);

  const today = utcMidnight(new Date());
  // The window covers `days` days ending today inclusive, so the first day is
  // (days - 1) days before today.
  const start = new Date(today.getTime() - (days - 1) * DAY_MS);

  const [
    newUsers,
    activeUsers,
    dailyActivity,
    logins,
    failedLogins,
    onlineRounds,
    soloRounds,
    campaignRuns,
    onlineKills,
    soloKills,
    levelsCreated,
  ] = await Promise.all([
    repo.newUsersSeries(start, "day"),
    repo.activeUsersSeries(start, "day"),
    dailyActivityRepo.activityByDay(dayKey(start), dayKey(today)),
    repo.loginsSeries(start, "day"),
    repo.failedLoginsSeries(start, "day"),
    repo.onlineRoundsSeries(start, "day"),
    repo.soloRoundsSeries(start, "day"),
    repo.campaignRunsSeries(start, "day"),
    repo.onlineKillsSeries(start, "day"),
    repo.soloKillsSeries(start, "day"),
    repo.levelsCreatedSeries(start, "day"),
  ]);

  const newUsersMap = toMap(newUsers, "day");
  const activeUsersMap = toMap(activeUsers, "day");
  const loginsMap = toMap(logins, "day");
  const failedLoginsMap = toMap(failedLogins, "day");
  const onlineRoundsMap = toMap(onlineRounds, "day");
  const soloRoundsMap = toMap(soloRounds, "day");
  const campaignRunsMap = toMap(campaignRuns, "day");
  const onlineKillsMap = toMap(onlineKills, "day");
  const soloKillsMap = toMap(soloKills, "day");
  const levelsCreatedMap = toMap(levelsCreated, "day");

  const dailyActivityMap = new Map<
    string,
    { total: number; guests: number; registered: number }
  >();
  for (const row of dailyActivity) {
    dailyActivityMap.set(bucketKey(row.day, "day"), {
      total: n(row.total),
      guests: n(row.guests),
      registered: n(row.registered),
    });
  }

  const series: AdminTimeseriesPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = dayKey(new Date(start.getTime() + i * DAY_MS));
    const online = onlineRoundsMap.get(date) ?? 0;
    const solo = soloRoundsMap.get(date) ?? 0;
    const campaign = campaignRunsMap.get(date) ?? 0;

    const da = dailyActivityMap.get(date);
    const legacy = activeUsersMap.get(date) ?? 0;
    const activeGuests = da ? da.guests : 0;
    const activeRegistered = Math.max(da ? da.registered : 0, legacy);
    const totalActive = activeGuests + activeRegistered;

    series.push({
      date,
      newUsers: newUsersMap.get(date) ?? 0,
      activeUsers: totalActive,
      activeGuests,
      activeRegistered,
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

export { getOverview, getTimeseries, getHourlyTimeseries };
