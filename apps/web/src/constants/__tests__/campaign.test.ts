import { describe, it, expect } from "vitest";
import { STARTING_LIVES, LIFE_EVERY } from "../campaign";

// Pins the campaign-rule contract that GameContext + GameCanvas both depend on.
describe("campaign rules", () => {
  it("freezes the starting lives and life-gain cadence", () => {
    expect(STARTING_LIVES).toBe(3);
    expect(LIFE_EVERY).toBe(5);
  });
});
