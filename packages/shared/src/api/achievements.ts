import { z } from "zod";

// The achievements catalog + the pure predicate functions that decide when each
// one is earned. This module is the SINGLE SOURCE OF TRUTH, imported by both the
// server (to evaluate unlocks at stat-submission time) and the web client (to
// render the locked/unlocked grid and resolve toast names via i18n by `key`).
//
// Definitions live in code, not the DB — the `OuiTank-player_achievements` table
// only stores WHICH keys a player has unlocked and WHEN. Names/descriptions are
// resolved client-side from i18n keys `achievements.items.<key>.{name,desc}`, so
// the wire only ever carries the stable string `key` (never localized text).
//
// Every criterion is computed from stats ALREADY persisted by the game
// (wins/kills/deaths/shots/hits/plants/blocks_destroyed per round, solo
// success/completions, campaign levelsCleared/completed) — the game runtime is
// untouched.

export type AchievementCategory = "online" | "mines" | "solo" | "campaign";

export interface AchievementDef {
  /** Stable wire id; also the i18n key suffix and DB `achievement_key`. */
  key: string;
  category: AchievementCategory;
  /** lucide-react icon name; the client maps it to a component. */
  icon: string;
}

// Display order within each category is the array order below.
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // --- Online: single round ---
  { key: "triple_threat", category: "online", icon: "Swords" },
  { key: "rampage", category: "online", icon: "Flame" },
  { key: "untouchable", category: "online", icon: "ShieldCheck" },
  { key: "pacifist", category: "online", icon: "Feather" },
  { key: "dead_eye", category: "online", icon: "Target" },
  // --- Online: cumulative ---
  { key: "first_blood", category: "online", icon: "Droplet" },
  { key: "sharpshooter", category: "online", icon: "Crosshair" },
  { key: "warlord", category: "online", icon: "Crown" },
  { key: "champion", category: "online", icon: "Trophy" },
  { key: "veteran", category: "online", icon: "Medal" },
  // --- Mines / demolition ---
  { key: "sapper", category: "mines", icon: "Bomb" },
  { key: "demolition_expert", category: "mines", icon: "Hammer" },
  // --- Solo ---
  { key: "first_steps", category: "solo", icon: "Footprints" },
  { key: "level_master", category: "solo", icon: "GraduationCap" },
  { key: "flawless_solo", category: "solo", icon: "Sparkles" },
  // --- Campaign ---
  { key: "campaigner", category: "campaign", icon: "Map" },
  { key: "campaign_marathoner", category: "campaign", icon: "Mountain" },
] as const;

export const ACHIEVEMENT_KEYS: readonly string[] = ACHIEVEMENTS.map(
  (a) => a.key
);

const KNOWN_KEYS = new Set(ACHIEVEMENT_KEYS);

/** True for a key that exists in the catalog (guards stale DB rows). */
export function isAchievementKey(key: string): boolean {
  return KNOWN_KEYS.has(key);
}

// --- Stat shapes the predicates consume ---------------------------------------

// One round's combat stats. Matches the game runtime's StatsCounters wire shape
// (note snake_case `blocks_destroyed`), so a `player.round_stats.stats` object is
// passed straight through on the online path.
export interface RoundStats {
  wins: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  plants: number;
  blocks_destroyed: number;
}

// The player's lifetime online totals (already summed + Number()-coerced by the
// caller — `getUserRoundStats` returns SQL sums as strings).
export interface OnlineAggregate {
  kills: number;
  wins: number;
  rounds_played: number;
  blocks_destroyed: number;
}

// A single solo round row (the just-submitted one).
export interface SoloRoundStats {
  success: boolean;
  deaths: number;
}

// The player's lifetime solo totals.
export interface SoloAggregate {
  levelsCompleted: number;
}

// A single campaign run row (the just-submitted one).
export interface CampaignRunStats {
  completed: boolean;
  levelsCleared: number;
}

// Accuracy threshold needs a floor on shots so a 1-shot 1-hit round doesn't
// trivially grant "Dead Eye".
const DEAD_EYE_MIN_SHOTS = 10;

/**
 * Evaluate every online-derived achievement against the just-finished round
 * (`round`) and the player's lifetime totals (`agg`). Returns the keys now
 * satisfied (the caller diffs these against what's already unlocked).
 */
export function evaluateOnline(
  round: RoundStats,
  agg: OnlineAggregate
): string[] {
  const earned: string[] = [];

  // Single round
  if (round.kills >= 3) earned.push("triple_threat");
  if (round.kills >= 5) earned.push("rampage");
  if (round.wins >= 1 && round.deaths === 0) earned.push("untouchable");
  if (round.wins >= 1 && round.shots === 0) earned.push("pacifist");
  if (round.shots >= DEAD_EYE_MIN_SHOTS && round.hits / round.shots >= 0.9)
    earned.push("dead_eye");
  if (round.plants >= 1) earned.push("sapper");

  // Cumulative
  if (agg.kills >= 1) earned.push("first_blood");
  if (agg.kills >= 100) earned.push("sharpshooter");
  if (agg.kills >= 500) earned.push("warlord");
  if (agg.wins >= 25) earned.push("champion");
  if (agg.rounds_played >= 50) earned.push("veteran");
  if (agg.blocks_destroyed >= 50) earned.push("demolition_expert");

  return earned;
}

/**
 * Evaluate solo achievements against the just-submitted solo round (`row`) and
 * the player's lifetime solo totals (`agg`).
 */
export function evaluateSolo(
  row: SoloRoundStats,
  agg: SoloAggregate
): string[] {
  const earned: string[] = [];
  if (row.success) earned.push("first_steps");
  if (row.success && row.deaths === 0) earned.push("flawless_solo");
  if (agg.levelsCompleted >= 25) earned.push("level_master");
  return earned;
}

/**
 * Evaluate campaign achievements against the just-submitted run.
 *
 * NOTE: a true "no life lost" criterion isn't reliably derivable server-side —
 * campaigns can *gain* lives mid-run, so `livesLeft` doesn't pin down losses.
 * `campaign_marathoner` (clear 5 levels in one run) is the robust, schema-free
 * skill achievement instead.
 */
export function evaluateCampaign(run: CampaignRunStats): string[] {
  const earned: string[] = [];
  if (run.completed) earned.push("campaigner");
  if (run.levelsCleared >= 5) earned.push("campaign_marathoner");
  return earned;
}

// --- Wire DTOs ----------------------------------------------------------------

// GET /api/achievements/me — only the player's UNLOCKED rows; the client treats
// any catalog key absent from this list as locked. `unlockedAt` is an ISO string.
export const UnlockedAchievementSchema = z.object({
  key: z.string(),
  unlockedAt: z.string(),
});
export type UnlockedAchievement = z.infer<typeof UnlockedAchievementSchema>;

export const MyAchievementsSchema = z.array(UnlockedAchievementSchema);
export type MyAchievements = z.infer<typeof MyAchievementsSchema>;

// Newly-unlocked keys returned inline by a stat submission (solo/campaign HTTP
// responses) or pushed over the `achievements_unlocked` socket event (online).
export const UnlockedKeysSchema = z.array(z.string());
export type UnlockedKeys = z.infer<typeof UnlockedKeysSchema>;
