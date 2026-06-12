// validateCoopLevels against the real database: every playlist entry must be
// a solo-type level carrying at least one bot spawn cell (codes 11–16).
import { cleanDb, createPlayer, createLevel } from "../helpers/db";
import { validateCoopLevels } from "../../services/levels.service";

beforeEach(async () => {
  await cleanDb();
});

// A 368-cell grid with the given cells stamped ([index, code]).
function grid(cells: Array<[number, number]> = []): number[] {
  const g = new Array<number>(368).fill(0);
  for (const [i, code] of cells) g[i] = code;
  return g;
}

describe("validateCoopLevels", () => {
  test("accepts a playlist of solo levels with bot AND player spawns", async () => {
    const creator = await createPlayer();
    const a = await createLevel(creator.id, {
      type: "solo",
      content: {
        data: grid([
          [100, 11],
          [200, 3],
        ]),
      },
    });
    const b = await createLevel(creator.id, {
      type: "solo",
      content: {
        data: grid([
          [120, 16],
          [220, 3],
        ]),
      },
    });
    expect(await validateCoopLevels([a.id, b.id])).toEqual({ ok: true });
  });

  test("rejects a level without a player spawn (the pool could never grow)", async () => {
    const creator = await createPlayer();
    const lvl = await createLevel(creator.id, {
      type: "solo",
      content: { data: grid([[100, 11]]) }, // bots, but no code-3 anchor
    });
    expect(await validateCoopLevels([lvl.id])).toEqual({
      ok: false,
      reason: "no_player_spawn",
    });
  });

  test("rejects an online-type level", async () => {
    const creator = await createPlayer();
    const lvl = await createLevel(creator.id, {
      type: "online",
      content: {
        data: grid([
          [100, 11],
          [200, 3],
        ]),
      },
    });
    expect(await validateCoopLevels([lvl.id])).toEqual({
      ok: false,
      reason: "not_solo",
    });
  });

  test("rejects a solo level without a single bot spawn", async () => {
    const creator = await createPlayer();
    const lvl = await createLevel(creator.id, {
      type: "solo",
      content: { data: grid([[100, 3]]) }, // a player spawn is not an enemy
    });
    expect(await validateCoopLevels([lvl.id])).toEqual({
      ok: false,
      reason: "no_bot_spawns",
    });
  });

  test("rejects an unknown level id and an empty playlist", async () => {
    expect(await validateCoopLevels([99999])).toEqual({
      ok: false,
      reason: "level_not_found",
    });
    expect(await validateCoopLevels([])).toEqual({
      ok: false,
      reason: "level_not_found",
    });
  });

  test("one bad entry fails the whole playlist", async () => {
    const creator = await createPlayer();
    const good = await createLevel(creator.id, {
      type: "solo",
      content: {
        data: grid([
          [100, 12],
          [200, 3],
        ]),
      },
    });
    const bad = await createLevel(creator.id, {
      type: "solo",
      content: { data: grid() },
    });
    expect(await validateCoopLevels([good.id, bad.id])).toEqual({
      ok: false,
      reason: "no_bot_spawns",
    });
  });
});
