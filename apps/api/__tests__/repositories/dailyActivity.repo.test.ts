import {
  upsertVisitor,
  deleteVisitor,
  activeVisitorCounts,
  activityByDay,
} from "../../repositories/dailyActivity.repo";
import { cleanDb, createPlayer } from "../helpers/db";

beforeEach(async () => {
  await cleanDb();
});

describe("dailyActivity.repo", () => {
  test("upsertVisitor inserts guest and registered rows idempotently", async () => {
    const player = await createPlayer();
    const today = "2026-10-26";

    // Insert guest
    await upsertVisitor({
      day: today,
      visitorKey: "c:guest_1",
      playerId: null,
    });

    // Insert player
    await upsertVisitor({
      day: today,
      visitorKey: `p:${player.id}`,
      playerId: player.id,
    });

    // Re-upsert player (conflict should update lastSeenAt without error)
    await upsertVisitor({
      day: today,
      visitorKey: `p:${player.id}`,
      playerId: player.id,
    });

    const counts = await activeVisitorCounts({
      today,
      d7: "2026-10-19",
      d30: "2026-09-26",
    });

    expect(Number(counts.activeToday)).toBe(2);
    expect(Number(counts.guestsToday)).toBe(1);
  });

  test("deleteVisitor removes visitor row for a given day", async () => {
    const today = "2026-10-26";
    await upsertVisitor({
      day: today,
      visitorKey: "c:guest_to_delete",
      playerId: null,
    });

    let counts = await activeVisitorCounts({
      today,
      d7: "2026-10-19",
      d30: "2026-09-26",
    });
    expect(Number(counts.activeToday)).toBe(1);

    await deleteVisitor(today, "c:guest_to_delete");

    counts = await activeVisitorCounts({
      today,
      d7: "2026-10-19",
      d30: "2026-09-26",
    });
    expect(Number(counts.activeToday)).toBe(0);
  });

  test("activityByDay groups visits by day with guest and registered breakdown", async () => {
    const p1 = await createPlayer();
    const p2 = await createPlayer();

    // Day 1: 1 guest, 1 player
    await upsertVisitor({
      day: "2026-10-25",
      visitorKey: "c:guest_a",
      playerId: null,
    });
    await upsertVisitor({
      day: "2026-10-25",
      visitorKey: `p:${p1.id}`,
      playerId: p1.id,
    });

    // Day 2: 2 players, 0 guests
    await upsertVisitor({
      day: "2026-10-26",
      visitorKey: `p:${p1.id}`,
      playerId: p1.id,
    });
    await upsertVisitor({
      day: "2026-10-26",
      visitorKey: `p:${p2.id}`,
      playerId: p2.id,
    });

    const rows = await activityByDay("2026-10-24", "2026-10-27");
    const byDay = new Map(rows.map((r) => [String(r.day).slice(0, 10), r]));

    const day1 = byDay.get("2026-10-25");
    expect(day1).toBeDefined();
    expect(Number(day1!.total)).toBe(2);
    expect(Number(day1!.guests)).toBe(1);
    expect(Number(day1!.registered)).toBe(1);

    const day2 = byDay.get("2026-10-26");
    expect(day2).toBeDefined();
    expect(Number(day2!.total)).toBe(2);
    expect(Number(day2!.guests)).toBe(0);
    expect(Number(day2!.registered)).toBe(2);
  });
});
