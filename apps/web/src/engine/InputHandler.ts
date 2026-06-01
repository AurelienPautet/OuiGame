/**
 * InputHandler - Manages keyboard and mouse input for the game
 * Provides direction, aim, and action states
 *
 * Input state lives on a single global (`window.gameInput`) shared across all
 * InputHandler instances, but the global key/mouse listeners are now owned by
 * the InputHandler lifecycle: the constructor attaches them and destroy()
 * removes them (resetting `listenersAttached`). The four handler functions are
 * stable module-level references, so add/remove are symmetric — destroy() truly
 * detaches without leaving stale listeners, and a subsequent game re-attaches
 * cleanly (previously, attaching once at module load meant input died for all
 * games after the first quit).
 *
 * Key→action mapping is configurable: `applyKeyBindings` (called by the React
 * SettingsContext whenever the user's bindings change) rebuilds a module-level
 * `code → action` map the handlers consult. Arrow keys are always a movement
 * fallback regardless of the user's bindings, so arrow players never lose
 * control even after rebinding the letter keys.
 */
import type { GameAction, KeyBindings } from "../lib/settings";

export interface GameInputState {
  direction: { x: number; y: number };
  aim: { x: number; y: number };
  click: boolean;
  plant: boolean;
  escapePressed: boolean;
  mvtSpeed: number;
  canvas: HTMLCanvasElement | null;
  listenersAttached: boolean;
}

export interface InputSnapshot {
  direction: { x: number; y: number };
  aim: { x: number; y: number };
  click: boolean;
  plant: boolean;
  escapePressed: boolean;
}

declare global {
  interface Window {
    gameInput?: GameInputState;
  }
}

// --- Configurable key → action mapping ---
//
// Default bindings are duplicated here (rather than imported from lib/settings)
// so the engine has a valid keymap from module load even before the React
// SettingsContext pushes the user's saved bindings via applyKeyBindings().
const DEFAULT_BINDINGS: KeyBindings = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  plant: "Space",
};

// Arrow keys are a permanent movement fallback — merged in unless the user has
// bound that exact code to something else.
const ARROW_FALLBACK: Record<string, GameAction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function buildKeymap(bindings: KeyBindings): Record<string, GameAction> {
  const map: Record<string, GameAction> = {};
  (Object.keys(bindings) as GameAction[]).forEach((action) => {
    map[bindings[action]] = action;
  });
  for (const [code, action] of Object.entries(ARROW_FALLBACK)) {
    if (!(code in map)) map[code] = action;
  }
  return map;
}

let keymap: Record<string, GameAction> = buildKeymap(DEFAULT_BINDINGS);

/** Rebuild the live code→action map from the user's bindings. */
export function applyKeyBindings(bindings: KeyBindings): void {
  keymap = buildKeymap(bindings);
}

// Global input state - persists across all InputHandler instances
if (typeof window !== "undefined") {
  if (!window.gameInput) {
    window.gameInput = {
      direction: { x: 0, y: 0 },
      aim: { x: 575, y: 400 }, // Center of 1150x800 canvas
      click: false,
      plant: false,
      escapePressed: false,
      // Only the SIGN of `direction` is consumed (Player.update / the server's
      // `tock` handler map it to the player's own mvtspeed in px/s), so this is
      // just a unit step, not an actual speed.
      mvtSpeed: 1,
      canvas: null,
      listenersAttached: false,
    };
  }
}

// Global input handlers - stable module-level references so the InputHandler
// lifecycle can both add (constructor) and remove (destroy) the exact same
// function objects.
function globalKeyDown(event: KeyboardEvent) {
  const input = window.gameInput;
  if (!input) return;
  // Escape (pause) is fixed, not rebindable.
  if (event.code === "Escape") {
    input.escapePressed = true;
    return;
  }
  switch (keymap[event.code]) {
    case "right":
      input.direction.x = input.mvtSpeed;
      break;
    case "left":
      input.direction.x = -input.mvtSpeed;
      break;
    case "up":
      input.direction.y = -input.mvtSpeed;
      break;
    case "down":
      input.direction.y = input.mvtSpeed;
      break;
    case "plant":
      input.plant = true;
      break;
  }
}

function globalKeyUp(event: KeyboardEvent) {
  const input = window.gameInput;
  if (!input) return;
  // Only release the axis if it's still moving the way this key drove it, so
  // releasing one of two opposing keys doesn't cancel the other.
  switch (keymap[event.code]) {
    case "right":
      if (input.direction.x > 0) input.direction.x = 0;
      break;
    case "left":
      if (input.direction.x < 0) input.direction.x = 0;
      break;
    case "up":
      if (input.direction.y < 0) input.direction.y = 0;
      break;
    case "down":
      if (input.direction.y > 0) input.direction.y = 0;
      break;
    // plant is a one-shot action; nothing to release.
  }
}

function globalMouseMove(event: MouseEvent) {
  const input = window.gameInput;
  if (!input || !input.canvas) return;
  const rect = input.canvas.getBoundingClientRect();

  const scaleX = input.canvas.width / rect.width;
  const scaleY = input.canvas.height / rect.height;

  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;

  input.aim = { x: mouseX, y: mouseY };
}

function globalMouseDown(event: MouseEvent) {
  const input = window.gameInput;
  if (!input) return;
  // Only register left mouse button
  if (event.button === 0) {
    input.click = true;
  }
}

export class InputHandler {
  constructor(canvas: HTMLCanvasElement) {
    if (typeof window === "undefined" || !window.gameInput) return;

    // Update the canvas reference - everything else is global
    window.gameInput.canvas = canvas;

    // Attach the global listeners here (owned by the lifecycle, not module
    // load) so destroy() can symmetrically remove them and a later game can
    // re-attach.
    if (!window.gameInput.listenersAttached) {
      window.addEventListener("keydown", globalKeyDown);
      window.addEventListener("keyup", globalKeyUp);
      window.addEventListener("mousemove", globalMouseMove);
      window.addEventListener("mousedown", globalMouseDown);
      window.gameInput.listenersAttached = true;
    }
  }

  // Getters/setters that delegate to global state
  get direction() {
    return window.gameInput!.direction;
  }

  get aim() {
    return window.gameInput!.aim;
  }

  set aim(value) {
    window.gameInput!.aim = value;
  }

  setScale(_scale: number) {
    // Scale is handled via canvas reference in global handlers
  }

  // Clear all input state (used when countdown ends to prevent teleporting)
  clearInput() {
    const input = window.gameInput;
    if (!input) return;
    input.direction = { x: 0, y: 0 };
    input.click = false;
    input.plant = false;
    input.escapePressed = false;
  }

  destroy() {
    if (typeof window === "undefined" || !window.gameInput) return;

    // Symmetric teardown: remove the same handler references attached in the
    // constructor so a later game can attach fresh listeners.
    if (window.gameInput.listenersAttached) {
      window.removeEventListener("keydown", globalKeyDown);
      window.removeEventListener("keyup", globalKeyUp);
      window.removeEventListener("mousemove", globalMouseMove);
      window.removeEventListener("mousedown", globalMouseDown);
      window.gameInput.listenersAttached = false;
    }
  }

  getInputState(): InputSnapshot {
    const input = window.gameInput!;
    const state: InputSnapshot = {
      direction: { ...input.direction },
      aim: { ...input.aim },
      click: input.click,
      plant: input.plant,
      escapePressed: input.escapePressed,
    };

    // Reset one-shot actions
    input.click = false;
    input.plant = false;
    input.escapePressed = false;

    return state;
  }
}
