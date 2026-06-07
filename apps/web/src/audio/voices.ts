/**
 * The app's sound palette — every effect is built on the fly from oscillators
 * and filtered noise (see `synth.ts`), so nothing is downloaded and each play
 * can vary slightly. Names fall into three groups: in-game events, game-state
 * stingers (countdown / win / lose) and the UI click layer.
 *
 * Aesthetic: soft and rounded (sine / triangle, gentle noise) — a cute modern
 * io game, not a bright 8-bit arcade.
 */
import { tone, noise, rand } from "./synth";

export type VoiceName =
  // In-game events
  | "shoot"
  | "ricochet"
  | "plant"
  | "fuse"
  | "explose"
  | "kill"
  // Game-state stingers
  | "countdownBeep"
  | "countdownGo"
  | "win"
  | "lose"
  | "draw"
  // UI
  | "uiClick"
  | "uiHover"
  | "uiToggleOn"
  | "uiToggleOff"
  | "uiOpen"
  | "uiClose"
  | "uiBack"
  | "uiTab"
  | "uiError"
  | "uiSuccess"
  | "notify";

type Voice = () => void;

// A few note frequencies (Hz) for the little jingles.
const C4 = 261.63;
const E4 = 329.63;
const G4 = 392.0;
const A4 = 440.0;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export const voices: Record<VoiceName, Voice> = {
  // ── In-game events ────────────────────────────────────────────────────────

  // Tank cannon: a soft rounded "pew" with a little air.
  shoot() {
    const j = rand(0.94, 1.06);
    tone({
      type: "sine",
      freq: 520 * j,
      freqEnd: 170,
      duration: 0.12,
      gain: 0.22,
      attack: 0.002,
    });
    tone({
      type: "triangle",
      freq: 200 * j,
      freqEnd: 90,
      duration: 0.12,
      gain: 0.15,
    });
    noise({
      duration: 0.07,
      gain: 0.05,
      filter: "lowpass",
      freq: 900 * j,
      freqEnd: 200,
    });
  },

  // Bullet bouncing off a wall: a soft little "ting".
  ricochet() {
    const p = rand(0.95, 1.12);
    tone({
      type: "sine",
      freq: 1400 * p,
      freqEnd: 1050 * p,
      duration: 0.14,
      gain: 0.1,
      attack: 0.001,
    });
    tone({
      type: "triangle",
      freq: 2100 * p,
      duration: 0.09,
      gain: 0.035,
      delay: 0.004,
    });
  },

  // Mine placed: a soft "bloop" with a gentle confirm note.
  plant() {
    tone({ type: "sine", freq: 300, freqEnd: 140, duration: 0.14, gain: 0.26 });
    tone({ type: "sine", freq: 620, duration: 0.07, gain: 0.1, delay: 0.05 });
  },

  // Mine fuse tick — a soft rounded warning blip.
  fuse() {
    tone({ type: "sine", freq: 760, duration: 0.06, gain: 0.1, attack: 0.002 });
  },

  // Explosion (tank or mine): a deep, soft "whump" — boomy, not harsh.
  explose() {
    noise({
      duration: 0.45,
      gain: 0.3,
      filter: "lowpass",
      freq: 900,
      freqEnd: 60,
      q: 0.7,
    });
    tone({
      type: "sine",
      freq: 140,
      freqEnd: 38,
      duration: 0.5,
      gain: 0.5,
      attack: 0.005,
    });
    tone({ type: "sine", freq: 320, freqEnd: 80, duration: 0.18, gain: 0.13 });
  },

  // Kill confirmed: a quick three-note marimba arpeggio.
  kill() {
    tone({ type: "triangle", freq: C5, duration: 0.1, gain: 0.12 });
    tone({
      type: "triangle",
      freq: E5,
      duration: 0.1,
      gain: 0.12,
      delay: 0.06,
    });
    tone({ type: "sine", freq: G5, duration: 0.16, gain: 0.11, delay: 0.12 });
  },

  // ── Game-state stingers ───────────────────────────────────────────────────

  // Countdown 3-2-1: one soft round beep.
  countdownBeep() {
    tone({
      type: "sine",
      freq: 640,
      duration: 0.13,
      gain: 0.16,
      attack: 0.005,
    });
    tone({ type: "triangle", freq: 640, duration: 0.1, gain: 0.05 });
  },

  // Countdown "GO!": a warm rising lift.
  countdownGo() {
    tone({
      type: "triangle",
      freq: 660,
      freqEnd: 990,
      duration: 0.28,
      gain: 0.17,
      attack: 0.005,
    });
    tone({
      type: "sine",
      freq: 990,
      freqEnd: 1320,
      duration: 0.28,
      gain: 0.07,
      delay: 0.02,
    });
  },

  // Victory: a rising major arpeggio with a soft octave sparkle.
  win() {
    const seq = [C5, E5, G5, C6];
    for (let i = 0; i < seq.length; i++) {
      const f = seq[i]!;
      const at = i * 0.12;
      tone({
        type: "triangle",
        freq: f,
        duration: 0.22,
        gain: 0.16,
        delay: at,
      });
      tone({
        type: "sine",
        freq: f * 2,
        duration: 0.16,
        gain: 0.035,
        delay: at,
      });
    }
  },

  // Defeat: a soft, warm descending figure.
  lose() {
    const seq = [G4, E4, C4];
    for (let i = 0; i < seq.length; i++) {
      const f = seq[i]!;
      const at = i * 0.17;
      tone({
        type: "triangle",
        freq: f,
        duration: 0.32,
        gain: 0.13,
        delay: at,
      });
      tone({ type: "sine", freq: f / 2, duration: 0.32, gain: 0.1, delay: at });
    }
  },

  // Draw: two neutral, equal tones.
  draw() {
    tone({ type: "triangle", freq: A4, duration: 0.22, gain: 0.13 });
    tone({
      type: "triangle",
      freq: A4,
      duration: 0.22,
      gain: 0.13,
      delay: 0.18,
    });
  },

  // ── UI ────────────────────────────────────────────────────────────────────

  // Generic button press — a soft rounded pop.
  uiClick() {
    tone({
      type: "sine",
      freq: 520,
      freqEnd: 720,
      duration: 0.06,
      gain: 0.11,
      attack: 0.002,
    });
    tone({
      type: "triangle",
      freq: 1040,
      duration: 0.03,
      gain: 0.03,
      delay: 0.005,
    });
  },

  // Whisper-quiet tick as the pointer lands on something interactive.
  uiHover() {
    tone({
      type: "sine",
      freq: 1000,
      duration: 0.03,
      gain: 0.03,
      attack: 0.002,
    });
  },

  uiToggleOn() {
    tone({ type: "sine", freq: 560, duration: 0.07, gain: 0.1 });
    tone({ type: "sine", freq: 840, duration: 0.09, gain: 0.1, delay: 0.05 });
  },

  uiToggleOff() {
    tone({ type: "sine", freq: 760, duration: 0.07, gain: 0.1 });
    tone({ type: "sine", freq: 500, duration: 0.09, gain: 0.1, delay: 0.05 });
  },

  // Panel / modal opening — a soft upward swoosh.
  uiOpen() {
    tone({
      type: "sine",
      freq: 420,
      freqEnd: 640,
      duration: 0.16,
      gain: 0.09,
      attack: 0.01,
    });
    noise({
      duration: 0.16,
      gain: 0.04,
      filter: "lowpass",
      freq: 700,
      freqEnd: 1700,
    });
  },

  // Panel / modal closing — the swoosh in reverse.
  uiClose() {
    tone({ type: "sine", freq: 620, freqEnd: 380, duration: 0.14, gain: 0.09 });
    noise({
      duration: 0.14,
      gain: 0.04,
      filter: "lowpass",
      freq: 1700,
      freqEnd: 600,
    });
  },

  uiBack() {
    tone({ type: "sine", freq: 420, freqEnd: 300, duration: 0.09, gain: 0.1 });
  },

  uiTab() {
    tone({ type: "sine", freq: 560, duration: 0.05, gain: 0.08 });
    tone({
      type: "triangle",
      freq: 840,
      duration: 0.05,
      gain: 0.04,
      delay: 0.01,
    });
  },

  // Something went wrong — a soft, polite descending "uh-oh".
  uiError() {
    tone({ type: "triangle", freq: 420, duration: 0.14, gain: 0.11 });
    tone({
      type: "triangle",
      freq: 320,
      duration: 0.18,
      gain: 0.11,
      delay: 0.12,
    });
  },

  // Something went right — a gentle rising triad.
  uiSuccess() {
    tone({ type: "triangle", freq: C5, duration: 0.1, gain: 0.11 });
    tone({
      type: "triangle",
      freq: E5,
      duration: 0.1,
      gain: 0.11,
      delay: 0.07,
    });
    tone({ type: "sine", freq: G5, duration: 0.14, gain: 0.1, delay: 0.14 });
  },

  // Neutral attention chime for incoming toasts.
  notify() {
    tone({ type: "sine", freq: 740, duration: 0.09, gain: 0.08 });
    tone({ type: "sine", freq: 1110, duration: 0.07, gain: 0.04, delay: 0.05 });
  },
};
