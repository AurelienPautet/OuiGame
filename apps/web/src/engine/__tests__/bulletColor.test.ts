import { describe, it, expect } from "vitest";
import { bulletFill } from "../Renderer.js";
import { palette } from "../../theme/palette.js";

// Regression for: "bots that shoot fresh (zero-bounce) bullets show yellow
// instead of red". The colour used to be driven by bounces *remaining*
// (max_bounce - bounce), so a freshly fired bullet with its full bounce budget
// came out yellow. Colour is now driven by bounces *taken*, so a direct shot is
// red and fades toward yellow as it ricochets.
describe("bulletFill", () => {
  it("colours a fresh (zero-bounce) bullet red", () => {
    expect(bulletFill(0)).toBe(palette.red);
  });

  it("ramps red → orange → yellow as the bullet bounces", () => {
    expect(bulletFill(0)).toBe(palette.red);
    expect(bulletFill(1)).toBe(palette.orange);
    expect(bulletFill(2)).toBe(palette.yellow);
  });

  it("clamps further bounces to yellow", () => {
    expect(bulletFill(3)).toBe(palette.yellow);
    expect(bulletFill(99)).toBe(palette.yellow);
  });

  it("treats a missing or negative count as fresh (red)", () => {
    expect(bulletFill(undefined)).toBe(palette.red);
    expect(bulletFill(-1)).toBe(palette.red);
  });
});
