// User settings: configurable keyboard bindings + toggleable visual/audio
// effects. Persisted as a single JSON blob in localStorage (via `storage`).
//
// Two consumers read these:
//   • the imperative engine — keybindings drive InputHandler's key→action map;
//     effect flags gate the WebGL post-processor, particles and sounds.
//   • the React SettingsModal — edits these and persists them.
//
// loadSettings() always merges the stored blob over the defaults, so a settings
// blob written by an older build (missing a newly-added field) still resolves
// to a complete, valid Settings object.
import { storage } from "./storage";

// Movement + plant are rebindable; aim/shoot stay on the mouse. Codes are
// KeyboardEvent.code values (layout-independent physical keys).
export type GameAction = "up" | "down" | "left" | "right" | "plant";

export type KeyBindings = Record<GameAction, string>;

export interface EffectSettings {
  /** WebGL bloom glow. */
  bloom: boolean;
  /** Camera trauma / screen-shake on big hits. */
  screenShake: boolean;
  /** Chromatic aberration (RGB split) at the screen edges. */
  aberration: boolean;
  /** Darkened corners. */
  vignette: boolean;
  /** Radial distortion waves from explosions / shots. */
  shockwaves: boolean;
  /** Canvas particle bursts (debris, sparks, muzzle flashes, trails). */
  particles: boolean;
  /** Full-screen red damage flash + warm kill-confirmed pop. */
  flashes: boolean;
  /** Living background, walls and holes (the field breathes, holes swirl). */
  scenery: boolean;
  /** Sound effects. */
  sound: boolean;
}

export interface Settings {
  keybindings: KeyBindings;
  effects: EffectSettings;
}

export const ACTION_LABELS: Record<GameAction, string> = {
  up: "Move up",
  down: "Move down",
  left: "Move left",
  right: "Move right",
  plant: "Plant mine",
};

export const EFFECT_LABELS: Record<keyof EffectSettings, string> = {
  bloom: "Bloom glow",
  screenShake: "Screen shake",
  aberration: "Chromatic aberration",
  vignette: "Vignette",
  shockwaves: "Shockwaves",
  particles: "Particles",
  flashes: "Damage / kill flashes",
  scenery: "Animated scenery",
  sound: "Sound effects",
};

export const DEFAULT_SETTINGS: Settings = {
  keybindings: {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    plant: "Space",
  },
  effects: {
    bloom: true,
    screenShake: true,
    aberration: true,
    vignette: true,
    shockwaves: true,
    particles: true,
    flashes: true,
    scenery: true,
    sound: true,
  },
};

// Layout presets for the four movement keys (plant stays Space). The settings
// modal also surfaces "Arrows" — handy since arrow keys are a permanent
// movement fallback in the engine, but a preset makes the intent explicit.
export const KEY_PRESETS = {
  WASD: {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    plant: "Space",
  },
  ZQSD: {
    up: "KeyZ",
    down: "KeyS",
    left: "KeyQ",
    right: "KeyD",
    plant: "Space",
  },
  Arrows: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    plant: "Space",
  },
} as const satisfies Record<string, KeyBindings>;

export type PresetName = keyof typeof KEY_PRESETS;

/** Name of the preset the bindings exactly match, or "Custom". */
export function matchPreset(b: KeyBindings): PresetName | "Custom" {
  for (const [name, preset] of Object.entries(KEY_PRESETS)) {
    if (
      (Object.keys(preset) as GameAction[]).every((a) => preset[a] === b[a])
    ) {
      return name as PresetName;
    }
  }
  return "Custom";
}

/** Human-readable label for a KeyboardEvent.code (e.g. "KeyW" → "W"). */
export function keyLabel(code: string): string {
  if (!code) return "—";
  const arrows: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
  };
  if (arrows[code]) return arrows[code]!;
  if (code === "Space") return "Space";
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!;
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return digit[1]!;
  // ShiftLeft/ControlRight/etc. → "Shift"/"Control", otherwise the raw code.
  const mod = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
  if (mod) return mod[1]!;
  return code;
}

/** Load settings, merging the stored blob over the defaults (forward-safe). */
export function loadSettings(): Settings {
  const stored = storage.getSettings<Partial<Settings>>();
  if (!stored) return structuredClone(DEFAULT_SETTINGS);
  return {
    keybindings: { ...DEFAULT_SETTINGS.keybindings, ...stored.keybindings },
    effects: { ...DEFAULT_SETTINGS.effects, ...stored.effects },
  };
}

export function saveSettings(settings: Settings): void {
  storage.setSettings(settings);
}
