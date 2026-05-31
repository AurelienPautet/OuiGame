import { getUserRoundStats, insertRound } from "../../repositories/stats.repo";
import { cleanDb, createPlayer, createLevel, createRound } from "../helpers/db";

// Isolation tests for the stats repo's aggregate query. Notably freezes the
// group-less-aggregate shape: a player with no rounds still gets ONE row back
// (null sums, rounds_played 0) — the repo's `: null` branch is effectively dead.

beforeEach(async () => {
  await cleanDb();
});

describe("getUserRoundStats", () => {
  test("returns a null-filled row (not null) when the player has no rounds", async () => {
    const player = await createPlayer();
    const stats = await getUserRoundStats(player.id);
    expect(stats).not.toBeNull();
    expect(stats!.kills).toBeNull();
    expect(stats!.rounds_played).toBe(0);
  });

  test("aggregates a player's rounds (sums as numeric strings, count as number)", async () => {
    const player = await createPlayer();
    const level = await createLevel(player.id);
    await createRound(player.id, level.id, { kills: 2, wins: 1 });
    await createRound(player.id, level.id, { kills: 3, wins: 0 });

    const stats = await getUserRoundStats(player.id);
    expect(Number(stats!.kills)).toBe(5);
    expect(Number(stats!.wins)).toBe(1);
    expect(stats!.rounds_played).toBe(2);
  });
});

describe("insertRound", () => {
  test("maps blocks_destroyed -> blocksDestroyed and round-trips through the aggregate", async () => {
    const player = await createPlayer();
    const level = await createLevel(player.id);

    await insertRound(player.id, level.id, {
      kills: 1,
      deaths: 0,
      wins: 1,
      shots: 4,
      hits: 2,
      plants: 1,
      blocks_destroyed: 3,
    });

    const stats = await getUserRoundStats(player.id);
    expect(stats!.rounds_played).toBe(1);
    expect(Number(stats!.blocks_destroyed)).toBe(3);
    expect(Number(stats!.shots)).toBe(4);
  });

  test("accepts an anonymous round (playerId null)", async () => {
    const player = await createPlayer();
    const level = await createLevel(player.id);
    await expect(
      insertRound(null, level.id, {
        kills: 0,
        deaths: 1,
        wins: 0,
        shots: 0,
        hits: 0,
        plants: 0,
        blocks_destroyed: 0,
      })
    ).resolves.toBeUndefined();
  });
});
