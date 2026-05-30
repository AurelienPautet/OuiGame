// Typed, centralized access to the browser localStorage keys the app uses, so
// the raw string keys + their value encodings live in exactly one place (they
// were previously scattered across GameContext, LandingPage, TankSelectModal,
// SocketContext, the auth hooks, and LevelSelector).
const KEYS = {
  sessionId: "session_id",
  playerName: "playerName",
  body: "body", // tank body colour INDEX, persisted as a string
  turret: "turret", // tank turret colour INDEX, persisted as a string
  tankBodyColor: "tank_body_color", // resolved colour NAME
  tankTurretColor: "tank_turret_color", // resolved colour NAME
  soloSelectorState: "soloLevelSelectorState", // JSON blob
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
} as const;
