import { describe, it, expect } from "vitest";
import { desaturateHex, palette } from "../palette";

describe("desaturateHex", () => {
  it("returns the colour untouched at amount 0 (full ammo)", () => {
    expect(desaturateHex(palette.red, 0)).toBe(palette.red);
  });

  it("collapses to a neutral grey at amount 1 (empty)", () => {
    const grey = desaturateHex(palette.red, 1);
    const r = parseInt(grey.slice(1, 3), 16);
    const g = parseInt(grey.slice(3, 5), 16);
    const b = parseInt(grey.slice(5, 7), 16);
    // Fully desaturated → all channels equal (a true grey).
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("preserves perceptual luminance when greyed out", () => {
    const red = 0xf1;
    const green = 0x4e;
    const blue = 0x54; // palette.red channels
    const expectedLuma = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
    const grey = desaturateHex(palette.red, 1);
    expect(parseInt(grey.slice(1, 3), 16)).toBe(expectedLuma);
  });

  it("clamps amounts outside 0..1", () => {
    expect(desaturateHex(palette.blue, -5)).toBe(
      desaturateHex(palette.blue, 0)
    );
    expect(desaturateHex(palette.blue, 5)).toBe(desaturateHex(palette.blue, 1));
  });

  it("leaves a partially-loaded hull between full colour and grey", () => {
    const half = desaturateHex(palette.green, 0.5);
    expect(half).not.toBe(palette.green);
    expect(half).not.toBe(desaturateHex(palette.green, 1));
  });

  it("passes transparent (hidden tanks) straight through", () => {
    expect(desaturateHex("transparent", 1)).toBe("transparent");
  });
});
