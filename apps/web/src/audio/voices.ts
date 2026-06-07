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

  // Tank cannon: a sharp crack over a punchy blast and a low thump — weighty
  // and real (transient + body + sub-bass + smoke tail).
  shoot() {
    const j = rand(0.96, 1.05);
    // Crack — the snappy transient.
    noise({
      duration: 0.045,
      gain: 0.5,
      attack: 0.0005,
      filter: "highpass",
      freq: 1800,
      drive: 2.2,
    });
    // Blast body.
    noise({
      duration: 0.13,
      gain: 0.4,
      attack: 0.001,
      filter: "lowpass",
      freq: 2200 * j,
      freqEnd: 280,
      q: 0.9,
      drive: 1.6,
    });
    // Sub thump — the weight.
    tone({
      type: "sine",
      freq: 190 * j,
      freqEnd: 46,
      duration: 0.16,
      gain: 0.6,
      attack: 0.001,
      drive: 1.5,
    });
    // Smoke tail.
    noise({
      duration: 0.2,
      gain: 0.12,
      filter: "lowpass",
      freq: 700,
      freqEnd: 120,
      delay: 0.02,
    });
  },

  // Bullet bouncing off a wall: a metallic zing with a percussive "thock".
  ricochet() {
    const p = rand(0.95, 1.1);
    // Low thock — gives the bounce a body/impact.
    tone({
      type: "triangle",
      freq: 300,
      freqEnd: 120,
      duration: 0.07,
      gain: 0.32,
      attack: 0.001,
      drive: 1.6,
    });
    // Metallic zing, pitch-dropping.
    tone({
      type: "triangle",
      freq: 2300 * p,
      freqEnd: 1300 * p,
      duration: 0.12,
      gain: 0.16,
      attack: 0.0008,
      drive: 1.3,
    });
    // Resonant metallic ring.
    noise({
      duration: 0.09,
      gain: 0.16,
      filter: "bandpass",
      freq: 2700 * p,
      q: 9,
      drive: 1.4,
    });
  },

  // Mine placed: a solid mechanical thunk + click.
  plant() {
    noise({
      duration: 0.03,
      gain: 0.28,
      attack: 0.0005,
      filter: "highpass",
      freq: 1500,
      drive: 1.6,
    });
    tone({
      type: "sine",
      freq: 260,
      freqEnd: 78,
      duration: 0.16,
      gain: 0.5,
      attack: 0.001,
      drive: 1.5,
    });
    tone({
      type: "triangle",
      freq: 520,
      duration: 0.05,
      gain: 0.1,
      delay: 0.04,
    });
  },

  // Mine fuse tick — a crisp warning click.
  fuse() {
    noise({ duration: 0.012, gain: 0.16, filter: "highpass", freq: 2600 });
    tone({
      type: "sine",
      freq: 900,
      duration: 0.045,
      gain: 0.13,
      attack: 0.001,
    });
  },

  // Explosion (tank or mine): a sharp onset, a deep saturated rumble, sub-bass
  // weight and a debris tail.
  explose() {
    // Onset transient.
    noise({
      duration: 0.05,
      gain: 0.6,
      attack: 0.0004,
      filter: "highpass",
      freq: 1200,
      drive: 2.6,
    });
    // Body rumble.
    noise({
      duration: 0.6,
      gain: 0.5,
      attack: 0.002,
      filter: "lowpass",
      freq: 1100,
      freqEnd: 40,
      q: 0.6,
      drive: 1.9,
    });
    // Sub-bass weight.
    tone({
      type: "sine",
      freq: 95,
      freqEnd: 24,
      duration: 0.7,
      gain: 0.75,
      attack: 0.002,
      drive: 1.6,
    });
    tone({
      type: "triangle",
      freq: 200,
      freqEnd: 48,
      duration: 0.22,
      gain: 0.2,
      drive: 1.4,
    });
    // Debris crackle tail.
    noise({
      duration: 0.35,
      gain: 0.16,
      filter: "lowpass",
      freq: 2600,
      freqEnd: 400,
      delay: 0.03,
    });
  },

  // Kill confirmed: a snappy two-note hit.
  kill() {
    noise({ duration: 0.02, gain: 0.2, filter: "highpass", freq: 2200 });
    tone({ type: "triangle", freq: C5, duration: 0.1, gain: 0.16, drive: 1.2 });
    tone({
      type: "triangle",
      freq: G5,
      duration: 0.14,
      gain: 0.14,
      delay: 0.07,
      drive: 1.2,
    });
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
