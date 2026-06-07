/**
 * The app's sound palette — every effect is built on the fly from oscillators
 * and filtered noise (see `synth.ts`), so nothing is downloaded and each play
 * can vary slightly. Names fall into three groups: in-game events, game-state
 * stingers (countdown / win / lose) and the UI click layer.
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

  // Tank cannon: a bright noise crack over a low pitch-dropping thump.
  shoot() {
    const j = rand(0.94, 1.06);
    noise({
      duration: 0.16,
      gain: 0.26,
      filter: "lowpass",
      freq: 1800 * j,
      freqEnd: 200,
      q: 1,
    });
    tone({
      type: "triangle",
      freq: 220 * j,
      freqEnd: 70,
      duration: 0.16,
      gain: 0.3,
      attack: 0.002,
    });
    tone({
      type: "square",
      freq: 90 * j,
      freqEnd: 48,
      duration: 0.12,
      gain: 0.16,
    });
  },

  // Bullet bouncing off a wall: a short, bright metallic zing.
  ricochet() {
    const p = rand(0.9, 1.18);
    tone({
      type: "square",
      freq: 2600 * p,
      freqEnd: 1700 * p,
      duration: 0.12,
      gain: 0.11,
      attack: 0.001,
    });
    tone({
      type: "triangle",
      freq: 3300 * p,
      freqEnd: 2100 * p,
      duration: 0.1,
      gain: 0.07,
      delay: 0.005,
    });
    noise({
      duration: 0.07,
      gain: 0.08,
      filter: "bandpass",
      freq: 4200 * p,
      q: 7,
    });
  },

  // Mine placed: a soft mechanical thunk topped with a little confirm beep.
  plant() {
    tone({ type: "sine", freq: 170, freqEnd: 80, duration: 0.12, gain: 0.3 });
    noise({ duration: 0.05, gain: 0.12, filter: "lowpass", freq: 700 });
    tone({
      type: "square",
      freq: 880,
      duration: 0.06,
      gain: 0.08,
      delay: 0.05,
    });
  },

  // Mine fuse tick — the repeating warning blip before it blows.
  fuse() {
    tone({
      type: "square",
      freq: 1500,
      duration: 0.05,
      gain: 0.12,
      attack: 0.001,
    });
  },

  // Explosion (tank or mine): a long filtered-noise roar over a sub boom.
  explose() {
    noise({
      duration: 0.5,
      gain: 0.4,
      filter: "lowpass",
      freq: 1200,
      freqEnd: 60,
      q: 0.7,
    });
    tone({
      type: "sine",
      freq: 120,
      freqEnd: 32,
      duration: 0.5,
      gain: 0.5,
      attack: 0.005,
    });
    tone({
      type: "sawtooth",
      freq: 80,
      freqEnd: 28,
      duration: 0.34,
      gain: 0.16,
    });
    noise({
      duration: 0.22,
      gain: 0.12,
      filter: "highpass",
      freq: 1600,
      delay: 0.02,
    });
  },

  // Kill confirmed: a quick three-note upward arpeggio.
  kill() {
    tone({ type: "square", freq: G4, duration: 0.07, gain: 0.13 });
    tone({ type: "square", freq: C5, duration: 0.08, gain: 0.13, delay: 0.06 });
    tone({
      type: "triangle",
      freq: E5,
      duration: 0.12,
      gain: 0.12,
      delay: 0.12,
    });
  },

  // ── Game-state stingers ───────────────────────────────────────────────────

  // Countdown 3-2-1: one clean mid beep.
  countdownBeep() {
    tone({
      type: "square",
      freq: 700,
      duration: 0.12,
      gain: 0.18,
      attack: 0.004,
    });
    tone({ type: "sine", freq: 700, duration: 0.12, gain: 0.1 });
  },

  // Countdown "GO!": a bright rising blast.
  countdownGo() {
    tone({
      type: "square",
      freq: 700,
      freqEnd: 1100,
      duration: 0.26,
      gain: 0.2,
    });
    tone({
      type: "triangle",
      freq: 1400,
      freqEnd: 2100,
      duration: 0.26,
      gain: 0.1,
      delay: 0.02,
    });
  },

  // Victory: a rising major arpeggio with a little sparkle on top.
  win() {
    const seq = [C5, E5, G5, C6];
    for (let i = 0; i < seq.length; i++) {
      const f = seq[i]!;
      const at = i * 0.12;
      tone({ type: "triangle", freq: f, duration: 0.2, gain: 0.16, delay: at });
      tone({ type: "square", freq: f, duration: 0.16, gain: 0.05, delay: at });
    }
  },

  // Defeat: a slow descending minor figure.
  lose() {
    const seq = [G4, E4, C4];
    for (let i = 0; i < seq.length; i++) {
      const f = seq[i]!;
      const at = i * 0.16;
      tone({ type: "sawtooth", freq: f, duration: 0.3, gain: 0.12, delay: at });
      tone({ type: "sine", freq: f / 2, duration: 0.3, gain: 0.1, delay: at });
    }
  },

  // Draw: two neutral, equal tones.
  draw() {
    tone({ type: "triangle", freq: A4, duration: 0.2, gain: 0.14 });
    tone({
      type: "triangle",
      freq: A4,
      duration: 0.2,
      gain: 0.14,
      delay: 0.18,
    });
  },

  // ── UI ────────────────────────────────────────────────────────────────────

  // Generic tactile button press.
  uiClick() {
    tone({
      type: "triangle",
      freq: 540,
      freqEnd: 620,
      duration: 0.05,
      gain: 0.1,
      attack: 0.001,
    });
    noise({ duration: 0.02, gain: 0.04, filter: "highpass", freq: 2000 });
  },

  // Whisper-quiet tick as the pointer lands on something interactive.
  uiHover() {
    tone({
      type: "sine",
      freq: 1200,
      duration: 0.03,
      gain: 0.035,
      attack: 0.001,
    });
  },

  uiToggleOn() {
    tone({ type: "triangle", freq: 520, duration: 0.06, gain: 0.1 });
    tone({
      type: "triangle",
      freq: 780,
      duration: 0.08,
      gain: 0.1,
      delay: 0.05,
    });
  },

  uiToggleOff() {
    tone({ type: "triangle", freq: 700, duration: 0.06, gain: 0.1 });
    tone({
      type: "triangle",
      freq: 460,
      duration: 0.08,
      gain: 0.1,
      delay: 0.05,
    });
  },

  // Panel / modal opening — a soft upward swoosh.
  uiOpen() {
    noise({
      duration: 0.18,
      gain: 0.06,
      filter: "bandpass",
      freq: 600,
      freqEnd: 2200,
      q: 0.8,
    });
    tone({ type: "sine", freq: 380, freqEnd: 560, duration: 0.16, gain: 0.08 });
  },

  // Panel / modal closing — the swoosh in reverse.
  uiClose() {
    noise({
      duration: 0.16,
      gain: 0.06,
      filter: "bandpass",
      freq: 2000,
      freqEnd: 500,
      q: 0.8,
    });
    tone({ type: "sine", freq: 540, freqEnd: 340, duration: 0.14, gain: 0.08 });
  },

  uiBack() {
    tone({
      type: "triangle",
      freq: 360,
      freqEnd: 260,
      duration: 0.08,
      gain: 0.1,
    });
  },

  uiTab() {
    tone({ type: "square", freq: 480, duration: 0.04, gain: 0.07 });
    tone({ type: "sine", freq: 720, duration: 0.05, gain: 0.05, delay: 0.01 });
  },

  // Something went wrong — a low buzzy descending tone.
  uiError() {
    tone({
      type: "sawtooth",
      freq: 320,
      freqEnd: 180,
      duration: 0.22,
      gain: 0.12,
    });
    tone({
      type: "square",
      freq: 160,
      freqEnd: 100,
      duration: 0.22,
      gain: 0.06,
    });
  },

  // Something went right — a quick rising triad.
  uiSuccess() {
    tone({ type: "triangle", freq: C5, duration: 0.09, gain: 0.12 });
    tone({
      type: "triangle",
      freq: E5,
      duration: 0.1,
      gain: 0.12,
      delay: 0.07,
    });
    tone({
      type: "triangle",
      freq: G5,
      duration: 0.13,
      gain: 0.11,
      delay: 0.14,
    });
  },

  // Neutral attention chime for incoming toasts.
  notify() {
    tone({ type: "sine", freq: 880, duration: 0.08, gain: 0.08 });
    tone({
      type: "triangle",
      freq: 1320,
      duration: 0.06,
      gain: 0.05,
      delay: 0.05,
    });
  },
};
