import { describe, it, expect } from "vitest";
import { bulletFill } from "../Renderer.js";
import { palette } from "../../theme/palette.js";

// Bullet colour tracks bounces *remaining* (max_bounce - bounce): a fresh bullet
// with its full bounce budget reads yellow and ramps toward red as it ricochets,
// turning red the hit before it expires. max_bounce defaults to 3 (the standard
// shot budget) when absent.
describe("bulletFill", () => {
  it("colours a fresh bullet (full budget) yellow", () => {
    expect(bulletFill(0, 3)).toBe(palette.yellow);
  });

  it("ramps yellow → orange → red as bounces remaining drops", () => {
    expect(bulletFill(1, 3)).toBe(palette.yellow); // 2 remaining
    expect(bulletFill(2, 3)).toBe(palette.orange); // 1 remaining
    expect(bulletFill(3, 3)).toBe(palette.red); // 0 remaining, about to expire
  });

  it("colours a one-bounce bullet by its remaining budget", () => {
    expect(bulletFill(0, 1)).toBe(palette.orange); // 1 remaining
    expect(bulletFill(1, 1)).toBe(palette.red); // 0 remaining
  });

  it("clamps a large remaining budget to yellow", () => {
    expect(bulletFill(0, 99)).toBe(palette.yellow);
  });

  it("defaults a missing max_bounce to the standard 3-bounce budget", () => {
    expect(bulletFill(0, undefined)).toBe(palette.yellow); // 3 remaining
    expect(bulletFill(3, undefined)).toBe(palette.red); // 0 remaining
  });

  it("clamps an over-bounced (negative remaining) bullet to red", () => {
    expect(bulletFill(5, 3)).toBe(palette.red);
  });
});
