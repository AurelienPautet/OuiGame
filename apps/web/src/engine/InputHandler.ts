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
 */

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

interface InputSnapshot {
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

// Global input state - persists across all InputHandler instances
if (typeof window !== "undefined") {
  if (!window.gameInput) {
    window.gameInput = {
      direction: { x: 0, y: 0 },
      aim: { x: 575, y: 400 }, // Center of 1150x800 canvas
      click: false,
      plant: false,
      escapePressed: false,
      mvtSpeed: 3,
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
  switch (event.code) {
    case "KeyD":
    case "ArrowRight":
      input.direction.x = input.mvtSpeed;
      break;
    case "KeyQ":
    case "KeyA":
    case "ArrowLeft":
      input.direction.x = -input.mvtSpeed;
      break;
    case "KeyZ":
    case "KeyW":
    case "ArrowUp":
      input.direction.y = -input.mvtSpeed;
      break;
    case "ArrowDown":
    case "KeyS":
      input.direction.y = input.mvtSpeed;
      break;
    case "Space":
      input.plant = true;
      break;
    case "Escape":
      input.escapePressed = true;
      break;
  }
}

function globalKeyUp(event: KeyboardEvent) {
  const input = window.gameInput;
  if (!input) return;
  switch (event.code) {
    case "KeyD":
    case "ArrowRight":
      if (input.direction.x > 0) input.direction.x = 0;
      break;
    case "KeyQ":
    case "KeyA":
    case "ArrowLeft":
      if (input.direction.x < 0) input.direction.x = 0;
      break;
    case "KeyZ":
    case "ArrowUp":
    case "KeyW":
      if (input.direction.y < 0) input.direction.y = 0;
      break;
    case "KeyS":
    case "ArrowDown":
      if (input.direction.y > 0) input.direction.y = 0;
      break;
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
