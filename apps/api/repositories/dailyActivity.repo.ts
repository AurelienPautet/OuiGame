// Daily-active-user repository — PURE Drizzle queries over
// OuiTank-daily_active_users. One row per unique visitor per UTC day; the
// socket layer writes rows, the admin dashboard reads aggregate counts.
import { db, schema } from "@ouigame/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";

const { dailyActiveUsers } = schema;

// Insert or refresh one visitor's row for a day. `playerId` is only ever set
// (never cleared) on conflict, so a guest row that authenticates later is
// upgraded without losing the day's activity.
async function upsertVisitor(values: {
  day: string;
  visitorKey: string;
  playerId: number | null;
}): Promise<void> {
  const now = new Date();
  const base = {
    day: values.day,
    visitorKey: values.visitorKey,
    firstSeenAt: now,
    lastSeenAt: now,
  };
  const insert =
    values.playerId === null ? base : { ...base, playerId: values.playerId };

  await db
    .insert(dailyActiveUsers)
    .values(insert)
    .onConflictDoUpdate({
      target: [dailyActiveUsers.day, dailyActiveUsers.visitorKey],
      set:
        values.playerId === null
          ? { lastSeenAt: now }
          : {
              lastSeenAt: now,
              playerId: sql`COALESCE(${dailyActiveUsers.playerId}, ${values.playerId})`,
            },
    });
}

// Atomically upgrade a guest visitor row to a registered player row in a single
// database transaction, preventing races where an interleaved guest insert
// recreates the guest entry after an authentication upgrade.
async function upgradeGuestToPlayer(values: {
  day: string;
  guestKey: string;
  playerKey: string;
  playerId: number;
}): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .delete(dailyActiveUsers)
      .where(
        and(
          eq(dailyActiveUsers.day, values.day),
          eq(dailyActiveUsers.visitorKey, values.guestKey)
        )
      );

    await tx
      .insert(dailyActiveUsers)
      .values({
        day: values.day,
        visitorKey: values.playerKey,
        playerId: values.playerId,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: [dailyActiveUsers.day, dailyActiveUsers.visitorKey],
        set: {
          lastSeenAt: now,
          playerId: sql`COALESCE(${dailyActiveUsers.playerId}, ${values.playerId})`,
        },
      });
  });
}

// Drop one visitor row for a day. Used when a guest authenticates: the guest
// identity is replaced by the player identity so the same human is not counted
// twice in the same day.
async function deleteVisitor(day: string, visitorKey: string): Promise<void> {
  await db
    .delete(dailyActiveUsers)
    .where(
      and(
        eq(dailyActiveUsers.day, day),
        eq(dailyActiveUsers.visitorKey, visitorKey)
      )
    );
}

// Distinct active visitors (guests + registered) within a window. A visitor
// who plays on several days is counted once across the window, matching the
// "active users (7d)" semantics of the dashboard.
async function activeVisitorCounts(since: {
  today: string;
  d7: string;
  d30: string;
}) {
  const result = await db
    .select({
      activeToday: sql`COUNT(DISTINCT ${dailyActiveUsers.visitorKey}) FILTER (WHERE ${dailyActiveUsers.day} >= ${since.today}::date)`,
      active7d: sql`COUNT(DISTINCT ${dailyActiveUsers.visitorKey}) FILTER (WHERE ${dailyActiveUsers.day} >= ${since.d7}::date)`,
      active30d: sql`COUNT(DISTINCT ${dailyActiveUsers.visitorKey}) FILTER (WHERE ${dailyActiveUsers.day} >= ${since.d30}::date)`,
      guestsToday: sql`COUNT(DISTINCT ${dailyActiveUsers.visitorKey}) FILTER (WHERE ${dailyActiveUsers.day} >= ${since.today}::date AND ${dailyActiveUsers.playerId} IS NULL)`,
    })
    .from(dailyActiveUsers);
  return result[0]!;
}

// Per-day totals with the registered/guest split. One grouped query returns
// every series the admin chart needs.
async function activityByDay(start: string, end: string) {
  return db
    .select({
      day: dailyActiveUsers.day,
      total: sql`COUNT(*)`,
      guests: sql`COUNT(*) FILTER (WHERE ${dailyActiveUsers.playerId} IS NULL)`,
      registered: sql`COUNT(*) FILTER (WHERE ${dailyActiveUsers.playerId} IS NOT NULL)`,
    })
    .from(dailyActiveUsers)
    .where(
      and(gte(dailyActiveUsers.day, start), lte(dailyActiveUsers.day, end))
    )
    .groupBy(dailyActiveUsers.day);
}

export {
  upsertVisitor,
  upgradeGuestToPlayer,
  deleteVisitor,
  activeVisitorCounts,
  activityByDay,
};
