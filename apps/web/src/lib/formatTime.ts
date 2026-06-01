/**
 * Shared M:SS time formatting for the game overlays. Two entry points because
 * the engine hands the solo end screen elapsed *seconds*, while the campaign
 * run/interstitial track *milliseconds*.
 */

/** Format whole seconds as `M:SS`. */
export function formatTimeSec(seconds: number): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Format milliseconds as `M:SS`. */
export function formatTimeMs(ms: number): string {
  if (!ms) return "0:00";
  return formatTimeSec(Math.floor(ms / 1000));
}
