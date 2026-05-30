// Plain object literals used across the wire. Keys are LOAD-BEARING: the game
// uses { w, h } for sizes, never { width, height }.
export interface Vector2 {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

// Per-round counters from shared/class/Stats.js. snake_case `blocks_destroyed`
// is load-bearing.
export interface StatsCounters {
  wins: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  plants: number;
  blocks_destroyed: number;
}

// A Postgres aggregate (SUM/AVG/RANK/COUNT-as-bigint) reaches the wire as a
// STRING via node-postgres. In formatLevels, absent aggregates are defaulted to
// the JS number 0 (`|| 0`), so the wire value is `string` when present and
// `number` (0) when absent. Modelling it as plain `number` would lie.
export type AggStringOrZero = string | number;
