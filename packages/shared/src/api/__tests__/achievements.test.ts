import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_KEYS,
  isAchievementKey,
  evaluateOnline,
  evaluateSolo,
  evaluateCampaign,
  type RoundStats,
  type OnlineAggregate,
} from "../achievements";

// A zeroed round/aggregate; spread + override the fields a case cares about.
const round = (over: Partial<RoundStats> = {}): RoundStats => ({
  wins: 0,
  kills: 0,
  deaths: 0,
  shots: 0,
  hits: 0,
  plants: 0,
  blocks_destroyed: 0,
  ...over,
});

const agg = (over: Partial<OnlineAggregate> = {}): OnlineAggregate => ({
  kills: 0,
  wins: 0,
  rounds_played: 0,
  blocks_destroyed: 0,
  ...over,
});

describe("achievements catalog", () => {
  it("has unique keys", () => {
    expect(new Set(ACHIEVEMENT_KEYS).size).toBe(ACHIEVEMENTS.length);
  });

  it("recognizes catalog keys and rejects unknown ones", () => {
    expect(isAchievementKey("first_blood")).toBe(true);
    expect(isAchievementKey("not_a_real_key")).toBe(false);
  });
});

describe("evaluateOnline", () => {
  it("awards nothing for an empty round with no history", () => {
    expect(evaluateOnline(round(), agg())).toEqual([]);
  });

  it("awards single-round kill milestones by threshold", () => {
    expect(evaluateOnline(round({ kills: 3 }), agg({ kills: 3 }))).toContain(
      "triple_threat"
    );
    expect(
      evaluateOnline(round({ kills: 3 }), agg({ kills: 3 }))
    ).not.toContain("rampage");
    expect(evaluateOnline(round({ kills: 5 }), agg({ kills: 5 }))).toEqual(
      expect.arrayContaining(["triple_threat", "rampage"])
    );
  });

  it("awards untouchable only on a win with no deaths", () => {
    expect(evaluateOnline(round({ wins: 1, deaths: 0 }), agg())).toContain(
      "untouchable"
    );
    expect(evaluateOnline(round({ wins: 1, deaths: 2 }), agg())).not.toContain(
      "untouchable"
    );
    expect(evaluateOnline(round({ wins: 0, deaths: 0 }), agg())).not.toContain(
      "untouchable"
    );
  });

  it("awards pacifist only on a win with zero shots", () => {
    expect(evaluateOnline(round({ wins: 1, shots: 0 }), agg())).toContain(
      "pacifist"
    );
    expect(evaluateOnline(round({ wins: 1, shots: 4 }), agg())).not.toContain(
      "pacifist"
    );
  });

  it("requires a 10-shot floor for dead_eye", () => {
    // 1/1 = 100% but below the shot floor → no award.
    expect(evaluateOnline(round({ shots: 1, hits: 1 }), agg())).not.toContain(
      "dead_eye"
    );
    expect(evaluateOnline(round({ shots: 10, hits: 9 }), agg())).toContain(
      "dead_eye"
    );
    expect(evaluateOnline(round({ shots: 10, hits: 8 }), agg())).not.toContain(
      "dead_eye"
    );
  });

  it("awards cumulative milestones from the aggregate", () => {
    expect(evaluateOnline(round(), agg({ kills: 1 }))).toContain("first_blood");
    expect(evaluateOnline(round(), agg({ kills: 100 }))).toEqual(
      expect.arrayContaining(["first_blood", "sharpshooter"])
    );
    expect(evaluateOnline(round(), agg({ kills: 500 }))).toEqual(
      expect.arrayContaining(["sharpshooter", "warlord"])
    );
    expect(evaluateOnline(round(), agg({ wins: 25 }))).toContain("champion");
    expect(evaluateOnline(round(), agg({ rounds_played: 50 }))).toContain(
      "veteran"
    );
    expect(evaluateOnline(round(), agg({ blocks_destroyed: 50 }))).toContain(
      "demolition_expert"
    );
  });

  it("awards sapper on a single planted mine", () => {
    expect(evaluateOnline(round({ plants: 1 }), agg())).toContain("sapper");
  });
});

describe("evaluateSolo", () => {
  it("awards first_steps on a successful round", () => {
    expect(
      evaluateSolo({ success: true, deaths: 1 }, { levelsCompleted: 1 })
    ).toContain("first_steps");
    expect(
      evaluateSolo({ success: false, deaths: 0 }, { levelsCompleted: 0 })
    ).toEqual([]);
  });

  it("awards flawless_solo only on a deathless win", () => {
    expect(
      evaluateSolo({ success: true, deaths: 0 }, { levelsCompleted: 1 })
    ).toContain("flawless_solo");
    expect(
      evaluateSolo({ success: true, deaths: 1 }, { levelsCompleted: 1 })
    ).not.toContain("flawless_solo");
  });

  it("awards level_master at 25 completed levels", () => {
    expect(
      evaluateSolo({ success: true, deaths: 0 }, { levelsCompleted: 25 })
    ).toContain("level_master");
    expect(
      evaluateSolo({ success: true, deaths: 0 }, { levelsCompleted: 24 })
    ).not.toContain("level_master");
  });
});

describe("evaluateCampaign", () => {
  it("awards campaigner on completion", () => {
    expect(evaluateCampaign({ completed: true, levelsCleared: 1 })).toContain(
      "campaigner"
    );
    expect(
      evaluateCampaign({ completed: false, levelsCleared: 1 })
    ).not.toContain("campaigner");
  });

  it("awards marathoner at 5 cleared levels regardless of completion", () => {
    expect(evaluateCampaign({ completed: false, levelsCleared: 5 })).toContain(
      "campaign_marathoner"
    );
    expect(
      evaluateCampaign({ completed: true, levelsCleared: 4 })
    ).not.toContain("campaign_marathoner");
  });
});
