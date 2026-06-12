import { storage } from "./storage";

// Which bot AI solo/campaign rooms run. Resolution order per visit:
//   1. URL param `?bots=v2|legacy` — either before the hash
//      (http://host/?bots=v2#/) or inside it (#/path?bots=v2), since the app
//      uses HashRouter and both shapes occur naturally;
//   2. the persisted localStorage dev toggle (see storage.setBotSystem);
//   3. DEFAULT_BOT_SYSTEM.
//
// NOTE: deliberately declares its own BotSystem type instead of importing
// @ouigame/shared — web unit tests import this file and the CI unit job does
// not build shared's dist. The union must match Room.bot_system structurally.
export type BotSystem = "legacy" | "v2";

// The v2 brain is the live bot system for solo and campaign play.
// `?bots=legacy` (or localStorage bot_system="legacy") is the permanent,
// zero-deploy escape hatch back to the original AI.
export const DEFAULT_BOT_SYSTEM: BotSystem = "v2";

function normalize(value: string | null): BotSystem | null {
  return value === "v2" || value === "legacy" ? value : null;
}

export function resolveBotSystem(): BotSystem {
  const fromSearch = normalize(
    new URLSearchParams(window.location.search).get("bots")
  );
  if (fromSearch) return fromSearch;

  const hashQuery = window.location.hash.split("?")[1] ?? "";
  const fromHash = normalize(new URLSearchParams(hashQuery).get("bots"));
  if (fromHash) return fromHash;

  const stored = normalize(storage.getBotSystem());
  return stored ?? DEFAULT_BOT_SYSTEM;
}
