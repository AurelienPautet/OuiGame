import { describe, it, expect } from "vitest";
import {
  extractBotCounts,
  getBotColor,
  hexToDataUrl,
  hasBotSpawns,
} from "../levelUtils";

describe("extractBotCounts", () => {
  it("returns an empty object for nullish or non-array input", () => {
    expect(extractBotCounts(null)).toEqual({});
    expect(extractBotCounts(undefined)).toEqual({});
    expect(extractBotCounts("nope" as unknown as number[])).toEqual({});
  });

  it("ignores cells <= 10 and maps bot cells (value-10) to counts", () => {
    expect(extractBotCounts([0, 1, 10])).toEqual({});
    expect(extractBotCounts([11, 11, 12, 5, 14])).toEqual({ 1: 2, 2: 1, 4: 1 });
  });
});

describe("getBotColor", () => {
  it("maps known bot types to colours", () => {
    expect(getBotColor(1)).toBe("blue");
    expect(getBotColor(2)).toBe("green");
    expect(getBotColor(3)).toBe("orange");
    expect(getBotColor(4)).toBe("red");
  });
  it("falls back to blue for unknown types", () => {
    expect(getBotColor(0)).toBe("blue");
    expect(getBotColor(99)).toBe("blue");
  });
});

describe("hexToDataUrl", () => {
  it("returns the fallback path for an empty string", () => {
    expect(hexToDataUrl("")).toBe("ressources/image/minia/test.png");
  });
  it("decodes hex into a base64 jpeg data URL", () => {
    // 0x61 0x62 -> "ab" -> btoa("ab") === "YWI="
    expect(hexToDataUrl("6162")).toBe("data:image/jpeg;base64,YWI=");
  });
});

describe("hasBotSpawns", () => {
  it("is true when any bot cell (11-16) is present", () => {
    expect(hasBotSpawns([0, 0, 11, 0])).toBe(true);
    expect(hasBotSpawns([0, 16])).toBe(true);
  });

  it("is false for walls, spawns, holes and empty grids", () => {
    expect(hasBotSpawns([0, 1, 2, 3, 4, 10])).toBe(false);
    expect(hasBotSpawns([])).toBe(false);
  });

  it("is false for nullish input", () => {
    expect(hasBotSpawns(null)).toBe(false);
    expect(hasBotSpawns(undefined)).toBe(false);
  });
});
