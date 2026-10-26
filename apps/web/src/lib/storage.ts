// Typed, centralized access to the browser localStorage keys the app uses, so
// the raw string keys + their value encodings live in exactly one place (they
// were previously scattered across GameContext, LandingPage, TankSelectModal,
// SocketContext, the auth hooks, and LevelSelector).
const KEYS = {
  sessionId: "session_id",
  clientId: "client_id",
  playerName: "playerName",
  body: "body", // tank body colour INDEX, persisted as a string
  turret: "turret", // tank turret colour INDEX, persisted as a string
  tankBodyColor: "tank_body_color", // resolved colour NAME
  tankTurretColor: "tank_turret_color", // resolved colour NAME
  soloSelectorState: "soloLevelSelectorState", // JSON blob
  campaignSelectorState: "campaignSelectorState", // JSON blob
  settings: "settings", // keybindings + effect toggles (JSON blob)
  botSystem: "bot_system", // dev toggle: which bot AI solo rooms run
  garage: "garage", // OuiCoins + owned/equipped tank paints (JSON blob)
} as const;

function readInt(key: string): number | null {
  const raw = window.localStorage.getItem(key);
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) ? n : null;
}

function readJson<T>(key: string): T | null {
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const storage = {
  // Session token (bearer; works cross-origin for the itch.io build).
  getSessionId: (): string | null =>
    window.localStorage.getItem(KEYS.sessionId),
  setSessionId: (token: string) =>
    window.localStorage.setItem(KEYS.sessionId, token),
  clearSessionId: () => window.localStorage.removeItem(KEYS.sessionId),
  hasSession: (): boolean => !!window.localStorage.getItem(KEYS.sessionId),

  // Stable anonymous client id for daily active visitor tracking.
  getClientId: (): string => {
    let id = window.localStorage.getItem(KEYS.clientId);
    if (!id) {
      id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.localStorage.setItem(KEYS.clientId, id);
    }
    return id;
  },

  getPlayerName: (): string | null =>
    window.localStorage.getItem(KEYS.playerName),
  setPlayerName: (name: string) =>
    window.localStorage.setItem(KEYS.playerName, name),

  // body / turret are colour indices persisted as strings (see tankColors).
  getBodyIndex: (): number | null => readInt(KEYS.body),
  getTurretIndex: (): number | null => readInt(KEYS.turret),
  setTankColors: (
    bodyIndex: number,
    turretIndex: number,
    bodyColorName: string,
    turretColorName: string
  ) => {
    window.localStorage.setItem(KEYS.body, String(bodyIndex));
    window.localStorage.setItem(KEYS.turret, String(turretIndex));
    window.localStorage.setItem(KEYS.tankBodyColor, bodyColorName);
    window.localStorage.setItem(KEYS.tankTurretColor, turretColorName);
  },

  getSoloSelectorState: <T>(): T | null => readJson<T>(KEYS.soloSelectorState),
  setSoloSelectorState: (value: unknown) =>
    window.localStorage.setItem(KEYS.soloSelectorState, JSON.stringify(value)),

  getCampaignSelectorState: <T>(): T | null =>
    readJson<T>(KEYS.campaignSelectorState),
  setCampaignSelectorState: (value: unknown) =>
    window.localStorage.setItem(
      KEYS.campaignSelectorState,
      JSON.stringify(value)
    ),

  // User settings blob (keybindings + effect toggles); see lib/settings.ts,
  // which merges this over the defaults so partial/older blobs stay valid.
  getSettings: <T>(): T | null => readJson<T>(KEYS.settings),
  setSettings: (value: unknown) =>
    window.localStorage.setItem(KEYS.settings, JSON.stringify(value)),

  // Tank-shop wallet + ownership. Read through lib/wallet, which validates the
  // blob (unknown paints, negative balances, stale equipped ids) on load.
  getGarage: <T>(): T | null => readJson<T>(KEYS.garage),
  setGarage: (value: unknown) =>
    window.localStorage.setItem(KEYS.garage, JSON.stringify(value)),

  // Dev toggle for the bot AI ("legacy" | "v2"); validated in lib/botSystem.
  getBotSystem: (): string | null =>
    window.localStorage.getItem(KEYS.botSystem),
  setBotSystem: (value: string) =>
    window.localStorage.setItem(KEYS.botSystem, value),
  clearBotSystem: () => window.localStorage.removeItem(KEYS.botSystem),
} as const;
