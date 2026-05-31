import { describe, it, expect } from "vitest";
import { TANK_COLORS, DEFAULT_TANK_COLOR, colorFromIndex } from "../tankColors";

describe("TANK_COLORS ordering (persisted indices depend on it)", () => {
  it("keeps blue first and a stable length/default", () => {
    expect(TANK_COLORS[0]).toBe("blue");
    expect(TANK_COLORS).toHaveLength(9);
    expect(DEFAULT_TANK_COLOR).toBe("orange");
  });
});

describe("colorFromIndex", () => {
  it("resolves in-range numeric and string indices", () => {
    expect(colorFromIndex(0)).toBe("blue");
    expect(colorFromIndex("3")).toBe("green");
  });
  it("falls back to the default for out-of-range / invalid indices", () => {
    expect(colorFromIndex(-1)).toBe(DEFAULT_TANK_COLOR);
    expect(colorFromIndex(9)).toBe(DEFAULT_TANK_COLOR);
    expect(colorFromIndex(99)).toBe(DEFAULT_TANK_COLOR);
    expect(colorFromIndex(1.5)).toBe(DEFAULT_TANK_COLOR);
    expect(colorFromIndex("abc")).toBe(DEFAULT_TANK_COLOR);
  });
  it("coerces null to index 0 (Number(null) === 0), yielding the first colour", () => {
    expect(colorFromIndex(null)).toBe("blue");
  });
});
