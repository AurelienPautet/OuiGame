import { describe, it, expect } from "vitest";
import { bulletFill } from "../Renderer.js";
import { palette } from "../../theme/palette.js";

// Bullet colour tracks bounces *remaining* (max_bounce - bounce): a fresh bullet
// with its full 3-bounce budget reads yellow and ramps through orange to red on
// its last live bounce. A bullet is destroyed the instant bounce reaches
// max_bounce, so it is never drawn with 0 remaining — the lowest count that ever
// renders is 1, which is why the palette index is remaining - 1 (so that last
// bounce is red rather than the never-seen 0-remaining state). max_bounce
// defaults to 3 (the standard shot budget) when absent.
describe("bulletFill", () => {
  it("colours a fresh bullet (full 3-bounce budget) yellow", () => {
    expect(bulletFill(0, 3)).toBe(palette.yellow);
  });

  it("ramps yellow → orange → red as the bullet uses up its bounces", () => {
    expect(bulletFill(0, 3)).toBe(palette.yellow); // 3 remaining, fresh
    expect(bulletFill(1, 3)).toBe(palette.orange); // 2 remaining
    expect(bulletFill(2, 3)).toBe(palette.red); // 1 remaining, last live bounce
  });

  it("colours a one-bounce bullet red (its only bounce is its last)", () => {
    expect(bulletFill(0, 1)).toBe(palette.red); // 1 remaining
  });

  it("clamps a large remaining budget to yellow", () => {
    expect(bulletFill(0, 99)).toBe(palette.yellow);
  });

  it("defaults a missing max_bounce to the standard 3-bounce budget", () => {
    expect(bulletFill(0, undefined)).toBe(palette.yellow); // 3 remaining
    expect(bulletFill(2, undefined)).toBe(palette.red); // 1 remaining
  });

  it("clamps the never-rendered 0/negative-remaining state to red", () => {
    expect(bulletFill(3, 3)).toBe(palette.red); // 0 remaining (bullet already gone)
    expect(bulletFill(5, 3)).toBe(palette.red); // over-bounced
  });
});
