// Single source of truth for the "diep.io arcade" palette.
//
// This module is mirrored by the `@theme` block in index.css (the Tailwind / DOM
// side) and imported DIRECTLY by the imperative engine (Renderer.ts,
// ParticleSystem.ts) so the canvas and the DOM never drift apart. Change a colour
// here and update index.css to match.

export const palette = {
  // team / shape colours (fill) + their darker outline variants (`*D`)
  blue: "#00b2e1",
  blueD: "#0085a8",
  red: "#f14e54",
  redD: "#b8383d",
  green: "#00e06a",
  greenD: "#00a64e",
  yellow: "#ffe869",
  yellowD: "#c9b53f",
  purple: "#bf7ff5",
  purpleD: "#9355c9",
  orange: "#ffb142",
  orangeD: "#c98821",
  teal: "#2dd4bf",
  tealD: "#1c9c8d",

  // field + ink
  ink: "#2b2f36", // signature dark outline
  inkSoft: "#555b66",
  field: "#c9cdd2",
  fieldLine: "#b8bdc4",
  panelDark: "#1f232a",
  white: "#ffffff",
} as const;

export interface TankColors {
  /** hull / body fill */
  fill: string;
  /** thick dark outline */
  stroke: string;
}

// Bridges the legacy colour-NAME system to arcade {fill, stroke} pairs. The names
// come from constants/tankColors.ts (TANK_COLORS) and the bot colours hard-coded
// in packages/shared/src/game/Room.js (`bot_colors`). Every name used by either
// MUST exist here. `*F` are capture-the-flag carrier variants (brighter hull).
const TANK_PALETTE: Record<string, TankColors> = {
  blue: { fill: palette.blue, stroke: palette.blueD },
  orange: { fill: palette.orange, stroke: palette.orangeD },
  red: { fill: palette.red, stroke: palette.redD },
  green: { fill: palette.green, stroke: palette.greenD },
  violet: { fill: palette.purple, stroke: palette.purpleD },
  yellow: { fill: palette.yellow, stroke: palette.yellowD },
  turquoise: { fill: palette.teal, stroke: palette.tealD },
  blueF: { fill: "#5ec9ee", stroke: palette.blueD },
  violetF: { fill: "#d2a6fb", stroke: palette.purpleD },
  // `none` = invisible tank (spectator / empty slot); renderer skips drawing it.
  none: { fill: "transparent", stroke: "transparent" },
};

const DEFAULT_TANK_COLORS: TankColors = {
  fill: palette.orange,
  stroke: palette.orangeD,
};

/** Resolve a colour name to its arcade {fill, stroke}, falling back to orange. */
export function tankColors(name: string): TankColors {
  return TANK_PALETTE[name] ?? DEFAULT_TANK_COLORS;
}

/** True for the invisible "none" tank — the renderer should draw nothing. */
export function isHiddenTank(name: string): boolean {
  return name === "none" || tankColors(name).fill === "transparent";
}

/** True for capture-the-flag carrier variants (e.g. "blueF", "violetF"). */
export function isFlagCarrier(name: string): boolean {
  return name.endsWith("F");
}

export interface Rgb {
  red: number;
  green: number;
  blue: number;
}

/** "#00b2e1" → { red, green, blue }. Used by the particle system. */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.slice(0, 2), 16),
    green: parseInt(h.slice(2, 4), 16),
    blue: parseInt(h.slice(4, 6), 16),
  };
}

/** Blend two #rrggbb colours: t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(ca.red, cb.red)}${ch(ca.green, cb.green)}${ch(ca.blue, cb.blue)}`;
}

/**
 * Drain a #rrggbb colour toward grey: amount=0 → untouched, amount=1 → a fully
 * desaturated grey of the same perceptual luminance (so the hull dims to grey
 * without also going darker/lighter). Used as a tank's ammo gauge — a loaded
 * hull keeps its team hue, an empty one washes out to grey. "transparent"
 * (hidden tanks) passes through untouched.
 */
export function desaturateHex(hex: string, amount: number): string {
  if (hex === "transparent") return hex;
  // A non-finite amount (NaN from a garbage snapshot) means "leave it alone"
  // rather than producing a "#NaNNaNNaN" fill.
  const t = Number.isFinite(amount) ? Math.min(1, Math.max(0, amount)) : 0;
  const { red, green, blue } = hexToRgb(hex);
  // Rec. 601 luma — the grey that reads as "the same brightness" to the eye.
  const luma = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
  const ch = (v: number) =>
    Math.round(v + (luma - v) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(red)}${ch(green)}${ch(blue)}`;
}

// How far a destroyed tank's colours are charred toward ink. Shared by the
// wreck hull (Renderer) and the flying cannon (Debris) so the body and the
// barrel that flew off it read as the SAME burnt material — same darkness.
export const WRECK_CHAR = 0.55;

/**
 * A tank colour NAME charred to the wreck shade: its own hue kept, darkened
 * toward ink by WRECK_CHAR. Returns "transparent" untouched for hidden tanks.
 */
export function wreckFill(name: string): string {
  const f = tankColors(name).fill;
  return f === "transparent" ? f : mixHex(f, palette.ink, WRECK_CHAR);
}
