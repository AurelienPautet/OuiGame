// Admin dashboard stats — PURE Drizzle queries for the overview headline
// metrics and the daily timeseries. No req/res, no business rules: each
// function returns raw aggregate rows (counts/sums come back as strings, dates
// as Date|null). The service coerces them to numbers, computes derived rates,
// and fills the contiguous date range.
import { db, schema } from "@ouigame/db";
import { and, sql, sum, count, countDistinct, gte, ilike } from "drizzle-orm";
import type { SQL, AnyColumn } from "drizzle-orm";

const {
  players,
  levels,
  campaigns,
  ratings,
  logings,
  rounds,
  soloRounds,
  campaignRuns,
  playerAchievements,
} = schema;

// A logings row counts as a successful *login* when its status looks like a
// success but is not a logout event. Reused by overview + timeseries.
function successLoginCond(): SQL {
  return and(
    ilike(logings.status, "%success%"),
    sql`${logings.status} NOT ILIKE 'logout%'`
  )!;
}

// --- Overview: players ---

// total, db/google split, and admin count in one pass.
async function playerCounts() {
  const result = await db
    .select({
      total: count(players.id),
      db: sql`COUNT(*) FILTER (WHERE ${players.type} = 'db')`,
      google: sql`COUNT(*) FILTER (WHERE ${players.type} = 'google')`,
      admins: sql`COUNT(*) FILTER (WHERE ${players.isAdmin})`,
    })
    .from(players);
  // Aggregate with no GROUP BY always yields exactly one row.
  return result[0]!;
}

// New players whose creation_timestamp is within each window (since UTC midnight
// today, last 7 days, last 30 days). Boundaries are passed in by the service so
// all time math lives there.
async function newPlayerCounts(since: { today: Date; d7: Date; d30: Date }) {
  const result = await db
    .select({
      newToday: sql`COUNT(*) FILTER (WHERE ${players.creationTimestamp} >= ${since.today})`,
      new7d: sql`COUNT(*) FILTER (WHERE ${players.creationTimestamp} >= ${since.d7})`,
      new30d: sql`COUNT(*) FILTER (WHERE ${players.creationTimestamp} >= ${since.d30})`,
    })
    .from(players);
  return result[0]!;
}

// Distinct players with a successful login within each window.
async function activePlayerCounts(since: { today: Date; d7: Date; d30: Date }) {
  const ok = successLoginCond();
  const result = await db
    .select({
      activeToday: sql`COUNT(DISTINCT ${logings.playerId}) FILTER (WHERE ${logings.attemptTimestamp} >= ${since.today})`,
      active7d: sql`COUNT(DISTINCT ${logings.playerId}) FILTER (WHERE ${logings.attemptTimestamp} >= ${since.d7})`,
      active30d: sql`COUNT(DISTINCT ${logings.playerId}) FILTER (WHERE ${logings.attemptTimestamp} >= ${since.d30})`,
    })
    .from(logings)
    .where(ok);
  return result[0]!;
}

// --- Overview: content ---

async function contentCounts() {
  const levelRows = await db
    .select({
      levels: count(levels.id),
      levelsUp: sql`COUNT(*) FILTER (WHERE ${levels.status} = 'up')`,
    })
    .from(levels);
  const campaignRows = await db
    .select({ campaigns: count(campaigns.id) })
    .from(campaigns);
  const ratingRows = await db
    .select({ ratings: count(ratings.id) })
    .from(ratings);
  return {
    levels: levelRows[0]!.levels,
    levelsUp: levelRows[0]!.levelsUp,
    campaigns: campaignRows[0]!.campaigns,
    ratings: ratingRows[0]!.ratings,
  };
}

// --- Overview: games ---

async function gameCounts() {
  const onlineRows = await db.select({ c: count(rounds.id) }).from(rounds);
  const soloRows = await db
    .select({ c: count(soloRounds.id) })
    .from(soloRounds);
  const campaignRows = await db
    .select({ c: count(campaignRuns.id) })
    .from(campaignRuns);
  return {
    onlineRounds: onlineRows[0]!.c,
    soloRounds: soloRows[0]!.c,
    campaignRuns: campaignRows[0]!.c,
  };
}

// --- Overview: combat (online rounds + solo rounds summed) ---

async function onlineCombatTotals() {
  const result = await db
    .select({
      kills: sum(rounds.kills),
      deaths: sum(rounds.deaths),
      wins: sum(rounds.wins),
      shots: sum(rounds.shots),
      hits: sum(rounds.hits),
      plants: sum(rounds.plants),
      blocksDestroyed: sum(rounds.blocksDestroyed),
    })
    .from(rounds);
  return result[0]!;
}

async function soloCombatTotals() {
  const result = await db
    .select({
      kills: sum(soloRounds.kills),
      deaths: sum(soloRounds.deaths),
      shots: sum(soloRounds.shots),
      hits: sum(soloRounds.hits),
      plants: sum(soloRounds.plants),
      blocksDestroyed: sum(soloRounds.blocksDestroyed),
    })
    .from(soloRounds);
  return result[0]!;
}

// --- Overview: solo completion ---

async function soloCompletion() {
  const result = await db
    .select({
      completions: sql`COUNT(*) FILTER (WHERE ${soloRounds.success})`,
      attempts: count(soloRounds.id),
      distinctLevelsCompleted: sql`COUNT(DISTINCT ${soloRounds.levelId}) FILTER (WHERE ${soloRounds.success})`,
    })
    .from(soloRounds);
  return result[0]!;
}

// --- Overview: campaign runs ---

async function campaignRunStats() {
  const result = await db
    .select({
      runs: count(campaignRuns.id),
      completions: sql`COUNT(*) FILTER (WHERE ${campaignRuns.completed})`,
    })
    .from(campaignRuns);
  return result[0]!;
}

// --- Overview: achievements ---

async function achievementCount() {
  const result = await db
    .select({ unlocked: count(playerAchievements.id) })
    .from(playerAchievements);
  return result[0]!;
}

// --- Overview: logins ---

async function loginCounts() {
  const result = await db
    .select({
      total: count(logings.id),
      success: sql`COUNT(*) FILTER (WHERE ${logings.status} ILIKE '%success%')`,
      failed: sql`COUNT(*) FILTER (WHERE ${logings.status} ILIKE '%fail%')`,
    })
    .from(logings);
  return result[0]!;
}

// --- Timeseries: one grouped query per metric ---

// Truncate a timestamp column to a UTC day and cast to a date, yielding the
// YYYY-MM-DD bucket key shared by every metric query below.
function dayBucket(tsCol: AnyColumn): SQL {
  return sql`date_trunc('day', ${tsCol})::date`;
}

// New players per day.
async function newUsersByDay(start: Date) {
  return db
    .select({
      day: dayBucket(players.creationTimestamp),
      value: count(players.id),
    })
    .from(players)
    .where(gte(players.creationTimestamp, start))
    .groupBy(dayBucket(players.creationTimestamp));
}

// Distinct players with a successful login per day.
async function activeUsersByDay(start: Date) {
  return db
    .select({
      day: dayBucket(logings.attemptTimestamp),
      value: countDistinct(logings.playerId),
    })
    .from(logings)
    .where(and(successLoginCond(), gte(logings.attemptTimestamp, start)))
    .groupBy(dayBucket(logings.attemptTimestamp));
}

// All login attempts per day.
async function loginsByDay(start: Date) {
  return db
    .select({
      day: dayBucket(logings.attemptTimestamp),
      value: count(logings.id),
    })
    .from(logings)
    .where(gte(logings.attemptTimestamp, start))
    .groupBy(dayBucket(logings.attemptTimestamp));
}

// Failed login attempts per day.
async function failedLoginsByDay(start: Date) {
  return db
    .select({
      day: dayBucket(logings.attemptTimestamp),
      value: count(logings.id),
    })
    .from(logings)
    .where(
      and(ilike(logings.status, "%fail%"), gte(logings.attemptTimestamp, start))
    )
    .groupBy(dayBucket(logings.attemptTimestamp));
}

// Online rounds per day.
async function onlineRoundsByDay(start: Date) {
  return db
    .select({ day: dayBucket(rounds.timestamp), value: count(rounds.id) })
    .from(rounds)
    .where(gte(rounds.timestamp, start))
    .groupBy(dayBucket(rounds.timestamp));
}

// Solo rounds per day.
async function soloRoundsByDay(start: Date) {
  return db
    .select({
      day: dayBucket(soloRounds.timestamp),
      value: count(soloRounds.id),
    })
    .from(soloRounds)
    .where(gte(soloRounds.timestamp, start))
    .groupBy(dayBucket(soloRounds.timestamp));
}

// Campaign runs per day.
async function campaignRunsByDay(start: Date) {
  return db
    .select({
      day: dayBucket(campaignRuns.timestamp),
      value: count(campaignRuns.id),
    })
    .from(campaignRuns)
    .where(gte(campaignRuns.timestamp, start))
    .groupBy(dayBucket(campaignRuns.timestamp));
}

// Online kills per day.
async function onlineKillsByDay(start: Date) {
  return db
    .select({ day: dayBucket(rounds.timestamp), value: sum(rounds.kills) })
    .from(rounds)
    .where(gte(rounds.timestamp, start))
    .groupBy(dayBucket(rounds.timestamp));
}

// Solo kills per day.
async function soloKillsByDay(start: Date) {
  return db
    .select({
      day: dayBucket(soloRounds.timestamp),
      value: sum(soloRounds.kills),
    })
    .from(soloRounds)
    .where(gte(soloRounds.timestamp, start))
    .groupBy(dayBucket(soloRounds.timestamp));
}

// Levels created per day.
async function levelsCreatedByDay(start: Date) {
  return db
    .select({
      day: dayBucket(levels.creationTimestamp),
      value: count(levels.id),
    })
    .from(levels)
    .where(gte(levels.creationTimestamp, start))
    .groupBy(dayBucket(levels.creationTimestamp));
}

export {
  playerCounts,
  newPlayerCounts,
  activePlayerCounts,
  contentCounts,
  gameCounts,
  onlineCombatTotals,
  soloCombatTotals,
  soloCompletion,
  campaignRunStats,
  achievementCount,
  loginCounts,
  newUsersByDay,
  activeUsersByDay,
  loginsByDay,
  failedLoginsByDay,
  onlineRoundsByDay,
  soloRoundsByDay,
  campaignRunsByDay,
  onlineKillsByDay,
  soloKillsByDay,
  levelsCreatedByDay,
};
