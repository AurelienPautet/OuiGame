import {
  evaluateOnlineRound,
  evaluateSolo,
  evaluateCampaign,
  getMyAchievements,
} from "../../services/achievements.service";
import * as soloService from "../../services/solo.service";
import {
  cleanDb,
  createPlayer,
  createLevel,
  createRound,
  createSoloRound,
  createCampaign,
} from "../helpers/db";

// Achievement evaluation against a REAL Postgres. The unlock ledger
// (player_achievements) is exercised end-to-end: evaluate → insert → idempotent
// re-evaluate, plus the logged-in-only guard via solo.service.submitRound.

beforeEach(async () => {
  await cleanDb();
});

// The round-stats shape the runtime hands to evaluateOnlineRound.
const roundStats = (over: Record<string, number> = {}) => ({
  wins: 0,
  kills: 0,
  deaths: 0,
  shots: 0,
  hits: 0,
  plants: 0,
  blocks_destroyed: 0,
  ...over,
});

describe("evaluateOnlineRound", () => {
  test("unlocks single-round and cumulative achievements for a big round", async () => {
    const player = await createPlayer();
    const level = await createLevel(player.id);
    // The round must already be recorded — the cumulative aggregate reads it.
    await createRound(player.id, level.id, { kills: 5, wins: 1, deaths: 0 });

    const unlocked = await evaluateOnlineRound(
      player.id,
      roundStats({ kills: 5, wins: 1, deaths: 0 })
    );

    expect(unlocked).toEqual(
      expect.arrayContaining([
        "triple_threat",
        "rampage",
        "untouchable",
        "first_blood",
      ])
    );
  });

  test("is idempotent — a repeat evaluation unlocks nothing new", async () => {
    const player = await createPlayer();
    const level = await createLevel(player.id);
    await createRound(player.id, level.id, { kills: 3, wins: 1 });

    const first = await evaluateOnlineRound(
      player.id,
      roundStats({ kills: 3, wins: 1 })
    );
    expect(first).toContain("triple_threat");

    // Same state again: the UNIQUE constraint + ON CONFLICT DO NOTHING means no
    // rows are re-inserted, so nothing is reported as newly unlocked.
    const second = await evaluateOnlineRound(
      player.id,
      roundStats({ kills: 3, wins: 1 })
    );
    expect(second).toEqual([]);
  });

  test("does not double-count across two rounds (no duplicate rows)", async () => {
    const player = await createPlayer();
    const level = await createLevel(player.id);

    await createRound(player.id, level.id, { kills: 3, wins: 1 });
    await evaluateOnlineRound(player.id, roundStats({ kills: 3, wins: 1 }));
    await createRound(player.id, level.id, { kills: 3, wins: 1 });
    await evaluateOnlineRound(player.id, roundStats({ kills: 3, wins: 1 }));

    const mine = await getMyAchievements(player.id);
    const tripleRows = mine.filter((a) => a.key === "triple_threat");
    expect(tripleRows).toHaveLength(1);
  });
});

describe("evaluateSolo", () => {
  test("unlocks first_steps and flawless_solo on a deathless win", async () => {
    const player = await createPlayer();
    const level = await createLevel(player.id, { type: "solo" });
    await createSoloRound(player.id, level.id, { success: true, deaths: 0 });

    const unlocked = await evaluateSolo(player.id, {
      success: true,
      deaths: 0,
    });
    expect(unlocked).toEqual(
      expect.arrayContaining(["first_steps", "flawless_solo"])
    );
  });
});

describe("evaluateCampaign", () => {
  test("unlocks campaigner on completion and is idempotent", async () => {
    const player = await createPlayer();
    const campaign = await createCampaign(player.id);

    const first = await evaluateCampaign(player.id, {
      completed: true,
      levelsCleared: 3,
    });
    expect(first).toContain("campaigner");
    void campaign;

    const second = await evaluateCampaign(player.id, {
      completed: true,
      levelsCleared: 3,
    });
    expect(second).toEqual([]);
  });
});

describe("getMyAchievements", () => {
  test("returns unlocked rows with ISO timestamps", async () => {
    const player = await createPlayer();
    await evaluateCampaign(player.id, { completed: true, levelsCleared: 5 });

    const mine = await getMyAchievements(player.id);
    const keys = mine.map((a) => a.key).sort();
    expect(keys).toEqual(["campaign_marathoner", "campaigner"]);
    // unlockedAt is serialized as an ISO string.
    expect(() => new Date(mine[0]!.unlockedAt).toISOString()).not.toThrow();
  });

  test("returns nothing for a player with no unlocks", async () => {
    const player = await createPlayer();
    expect(await getMyAchievements(player.id)).toEqual([]);
  });
});

describe("logged-in-only guard (via solo.service.submitRound)", () => {
  test("an anonymous solo round unlocks nothing", async () => {
    const player = await createPlayer();
    const level = await createLevel(player.id, { type: "solo" });

    const result = await soloService.submitRound(null, {
      levelId: level.id,
      success: true,
      timeMs: 1000,
      deaths: 0,
    });
    expect(result).toEqual([]);
  });

  test("a logged-in solo round returns its unlocked keys", async () => {
    const player = await createPlayer();
    const level = await createLevel(player.id, { type: "solo" });

    const result = await soloService.submitRound(player.id, {
      levelId: level.id,
      success: true,
      timeMs: 1000,
      deaths: 0,
    });
    expect(result).toEqual(
      expect.arrayContaining(["first_steps", "flawless_solo"])
    );
  });
});
