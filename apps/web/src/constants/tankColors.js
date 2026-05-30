// Ordered list of selectable tank colors. The index into this array is what
// gets persisted to localStorage ("body" / "turret"), so the ORDER must stay
// stable — append new colors at the end, never reorder.
export const TANK_COLORS = [
  "blue",
  "orange",
  "red",
  "green",
  "violet",
  "yellow",
  "blueF",
  "turquoise",
  "violetF",
];

export const DEFAULT_TANK_COLOR = "orange";

// Resolve a persisted index to a color name, falling back to the default.
export function colorFromIndex(index) {
  const i = Number(index);
  return Number.isInteger(i) && i >= 0 && i < TANK_COLORS.length
    ? TANK_COLORS[i]
    : DEFAULT_TANK_COLOR;
}
