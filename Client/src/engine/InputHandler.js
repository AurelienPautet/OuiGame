/**
 * InputHandler - Manages keyboard and mouse input for the game
 * Provides direction, aim, and action states
 *
 * Uses singleton pattern - all state is global and only one set of listeners exists.
 * This prevents event listener accumulation when React remounts components.
 */

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

// Global input handlers - defined once, never removed
function globalKeyDown(event) {
  const input = window.gameInput;
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

function globalKeyUp(event) {
  const input = window.gameInput;
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

function globalMouseMove(event) {
  const input = window.gameInput;
  if (!input.canvas) return;
  const rect = input.canvas.getBoundingClientRect();

  const scaleX = input.canvas.width / rect.width;
  const scaleY = input.canvas.height / rect.height;

  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;

  input.aim = { x: mouseX, y: mouseY };
}

function globalMouseDown(event) {
  // Only register left mouse button
  if (event.button === 0) {
    window.gameInput.click = true;
  }
}

// Attach global listeners ONCE
if (typeof window !== "undefined" && !window.gameInput.listenersAttached) {
  window.addEventListener("keydown", globalKeyDown);
  window.addEventListener("keyup", globalKeyUp);
  window.addEventListener("mousemove", globalMouseMove);
  window.addEventListener("mousedown", globalMouseDown);
  window.gameInput.listenersAttached = true;
}

export class InputHandler {
  constructor(canvas) {
    // Update the canvas reference - everything else is global
    window.gameInput.canvas = canvas;
  }

  // Getters/setters that delegate to global state
  get direction() {
    return window.gameInput.direction;
  }

  get aim() {
    return window.gameInput.aim;
  }

  set aim(value) {
    window.gameInput.aim = value;
  }

  setScale(_scale) {
    // Scale is handled via canvas reference in global handlers
  }

  // Clear all input state (used when countdown ends to prevent teleporting)
  clearInput() {
    const input = window.gameInput;
    input.direction = { x: 0, y: 0 };
    input.click = false;
    input.plant = false;
    input.escapePressed = false;
  }

  destroy() {
    // Don't remove listeners - they're global and shared
  }

  getInputState() {
    const input = window.gameInput;
    const state = {
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
