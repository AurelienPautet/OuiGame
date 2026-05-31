import * as rankingsService from "../../services/rankings.service";
import { cleanDb, createPlayer, createLevel, createRound } from "../helpers/db";

// Exercises the rankings repo through the service so the getSelectExpr switch
// (KILLS / WINS / ROUNDS_PLAYED / invalid) and the RANK() tie-breaking + the
// getPlayerRank trichotomy are all covered with one fixture set.

beforeEach(async () => {
  await cleanDb();
});

// Three players; p1 and p2 tie on kills (10), p3 trails (5). p1 also plays an
// extra round, so ROUNDS_PLAYED ranks p1 alone at the top.
async function seedLeaderboard() {
  const p1 = await createPlayer({ username: "p1" });
  const p2 = await createPlayer({ username: "p2" });
  const p3 = await createPlayer({ username: "p3" });
  const level = await createLevel(p1.id);
  await createRound(p1.id, level.id, { kills: 10, wins: 2 });
  await createRound(p1.id, level.id, { kills: 0, wins: 0 }); // p1's 2nd round
  await createRound(p2.id, level.id, { kills: 10, wins: 1 });
  await createRound(p3.id, level.id, { kills: 5, wins: 0 });
  return { p1, p2, p3 };
}

describe("getRankings", () => {
  test("ranks by KILLS with shared ranks on ties", async () => {
    await seedLeaderboard();
    const rows = await rankingsService.getRankings("KILLS");
    expect(rows).toHaveLength(3);
    // p1 & p2 tie at 10 kills -> both rank 1; p3 -> rank 3 (RANK semantics).
    const rank1 = rows!.filter((r) => Number(r.rank) === 1);
    expect(rank1).toHaveLength(2);
    const last = rows![rows!.length - 1]!;
    expect(last.username).toBe("p3");
    expect(Number(last.rank)).toBe(3);
  });

  test("supports the WINS aggregate", async () => {
    await seedLeaderboard();
    const rows = await rankingsService.getRankings("WINS");
    expect(rows![0]!.username).toBe("p1"); // 2 wins, alone at the top
    expect(Number(rows![0]!.total_data)).toBe(2);
  });

  test("supports the ROUNDS_PLAYED aggregate", async () => {
    await seedLeaderboard();
    const rows = await rankingsService.getRankings("ROUNDS_PLAYED");
    expect(rows![0]!.username).toBe("p1"); // 2 rounds
    expect(Number(rows![0]!.total_data)).toBe(2);
  });

  test("returns undefined for an unknown ranking type", async () => {
    expect(await rankingsService.getRankings("NONSENSE")).toBeUndefined();
  });
});

describe("getPlayerRank", () => {
  test("returns the player's own ranked row", async () => {
    const { p1 } = await seedLeaderboard();
    const rank = await rankingsService.getPlayerRank("KILLS", p1.id);
    expect(rank).toMatchObject({ username: "p1" });
    expect(Number((rank as { rank: unknown }).rank)).toBe(1);
  });

  test("returns undefined for an invalid type", async () => {
    const { p1 } = await seedLeaderboard();
    expect(await rankingsService.getPlayerRank("BAD", p1.id)).toBeUndefined();
  });

  test("returns null for an unknown player id", async () => {
    await seedLeaderboard();
    expect(await rankingsService.getPlayerRank("KILLS", 999999)).toBeNull();
  });

  test("returns null for a real player who has no rounds (absent from rankings)", async () => {
    await seedLeaderboard();
    const loner = await createPlayer({ username: "loner" });
    expect(await rankingsService.getPlayerRank("KILLS", loner.id)).toBeNull();
  });
});
