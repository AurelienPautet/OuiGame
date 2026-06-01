import {
  parseId,
  getCreatorName,
  getImgFromLevelId,
  formatLevels,
} from "../../repositories/shared/format";
import {
  cleanDb,
  createPlayer,
  createLevel,
  createRound,
  createSoloRound,
} from "../helpers/db";

beforeEach(async () => {
  await cleanDb();
});

describe("parseId", () => {
  test("accepts a single positive integer string", () => {
    expect(parseId("5")).toBe(5);
  });
  test("rejects zero, negatives, decimals, and non-numeric strings", () => {
    expect(parseId("0")).toBeNull();
    expect(parseId("-1")).toBeNull();
    expect(parseId("1.5")).toBeNull();
    expect(parseId("abc")).toBeNull();
  });
  test("rejects a repeated param (array) and a missing param (undefined)", () => {
    expect(parseId(["1", "2"])).toBeNull();
    expect(parseId(undefined)).toBeNull();
  });
});

describe("getCreatorName / getImgFromLevelId", () => {
  test("getCreatorName returns the username, or 'Unknown' when missing", async () => {
    const player = await createPlayer({ username: "maker" });
    expect(await getCreatorName(player.id)).toBe("maker");
    expect(await getCreatorName(999999)).toBe("Unknown");
  });

  test("getImgFromLevelId returns hex when present, null when absent", async () => {
    const player = await createPlayer();
    const withImg = await createLevel(player.id, { img: "6162" });
    const noImg = await createLevel(player.id);
    expect(await getImgFromLevelId(withImg.id)).toBe("6162");
    expect(await getImgFromLevelId(noImg.id)).toBeNull();
  });
});

describe("formatLevels", () => {
  test("returns an empty array for no rows", async () => {
    expect(await formatLevels([])).toEqual([]);
  });

  test("shapes a level row with creator name, round stats, and solo stats", async () => {
    const creator = await createPlayer({ username: "creator1" });
    const level = await createLevel(creator.id, { type: "solo" });
    await createRound(creator.id, level.id, { kills: 3 });
    await createSoloRound(creator.id, level.id, {
      success: true,
      timeMs: 1000,
    });
    await createSoloRound(creator.id, level.id, {
      success: false,
      timeMs: 2000,
    });

    const [dto] = await formatLevels([
      {
        id: level.id,
        name: level.name,
        content: { data: [] },
        creatorId: creator.id,
        maxPlayers: 2,
        rating: 0,
        type: "solo",
        status: "up",
      },
    ]);

    expect(dto!.level_creator_name).toBe("creator1");
    expect(Number(dto!.level_kills)).toBe(3);
    expect(dto!.level_rounds_played).toBe(1);
    expect(dto!.solo_times_played).toBe(2);
    expect(dto!.solo_success_rate).toBe(50); // 1 of 2 successful
    expect(dto!.solo_best_time_ms).toBe(1000);
  });

  test("falls back to 'Unknown' creator and zeroed stats when data is missing", async () => {
    const creator = await createPlayer();
    const level = await createLevel(creator.id);

    const [dto] = await formatLevels([
      {
        id: level.id,
        name: "Orphan",
        content: { data: [] },
        creatorId: 999999, // no such player
        maxPlayers: 2,
        rating: 0,
        type: "online",
        status: "up",
      },
    ]);

    expect(dto!.level_creator_name).toBe("Unknown");
    expect(dto!.level_kills).toBe(0);
    expect(dto!.level_rounds_played).toBe(0);
    expect(dto!.solo_times_played).toBe(0);
    expect(dto!.level_img).toBeNull();
  });
});
