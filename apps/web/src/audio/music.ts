/**
 * MusicEngine — an adaptive, fully procedural soundtrack inspired by Wii Play's
 * Tanks!: a constant marching melody + bass over which percussion and harmony
 * layers fade in and out with the on-screen intensity (how many enemy tanks are
 * still alive). Quiet on the menus, building as a round heats up, thinning back
 * out as you clear tanks.
 *
 * A look-ahead scheduler (the standard Web-Audio-clock pattern) sequences short
 * synthesised notes; each layer has its own gain node so it can be crossfaded in
 * or out without clicks. Everything routes to the bus's music sub-bus, so the
 * "Music" setting mutes it independently of the sound effects.
 */
import { audioBus } from "./AudioBus";

type Mode = "menu" | "game";
type LayerName =
  | "melody"
  | "bass"
  | "arp"
  | "kick"
  | "snare"
  | "hat"
  | "cymbal"
  | "timpani";

// ── Musical content (C major, a 4-bar I–vi–IV–V loop) ────────────────────────
// Menus stay slow and gentle; a round runs a bit livelier.
const BPM_MENU = 80;
const BPM_GAME = 104;
const stepDurFor = (mode: Mode): number =>
  60 / (mode === "game" ? BPM_GAME : BPM_MENU) / 4; // one sixteenth note (s)
const STEPS_PER_BAR = 16;
const TOTAL_STEPS = STEPS_PER_BAR * 4;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12; // seconds of audio to schedule past "now"

// Note frequencies (Hz) for the octaves the parts span.
const NOTE: Record<string, number> = {
  A1: 55.0,
  C2: 65.41,
  D3: 146.83,
  E2: 82.41,
  F2: 87.31,
  G2: 98.0,
  C3: 130.81,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  A5: 880.0,
};
const freq = (name: string): number => NOTE[name] ?? 0;

// Melody: eight eighth-notes per bar (read at even sixteenth steps).
const MELODY: string[] = [
  "C5",
  "E5",
  "G5",
  "E5",
  "C5",
  "E5",
  "G5",
  "A5", // C
  "A4",
  "C5",
  "E5",
  "C5",
  "A4",
  "C5",
  "E5",
  "D5", // Am
  "F4",
  "A4",
  "C5",
  "A4",
  "F4",
  "A4",
  "C5",
  "D5", // F
  "G4",
  "B4",
  "D5",
  "B4",
  "G4",
  "B4",
  "D5",
  "G5", // G
];

// Per-bar bass: root on beat 1, fifth on beat 3 (a marching oom-pah).
const BASS_ROOT = ["C2", "A1", "F2", "G2"];
const BASS_FIFTH = ["G2", "E2", "C3", "D3"];

// Per-bar triad, arpeggiated on every sixteenth.
const ARP = [
  ["C4", "E4", "G4", "C5"],
  ["A3", "C4", "E4", "A4"],
  ["F3", "A3", "C4", "F4"],
  ["G3", "B3", "D4", "G4"],
];

// ── Synthesis helpers (all connect to a given layer's gain node) ─────────────
const MIN = 0.0001;

let noiseBuf: AudioBuffer | null = null;
let noiseCtx: AudioContext | null = null;
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseCtx === ctx) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  noiseCtx = ctx;
  return buf;
}

function mTone(
  ctx: AudioContext,
  dest: AudioNode,
  f: number,
  time: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  fEnd?: number
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f, time);
  if (fEnd != null)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, fEnd), time + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(MIN, time);
  g.gain.exponentialRampToValueAtTime(gain, time + 0.006);
  g.gain.exponentialRampToValueAtTime(MIN, time + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.02);
}

function mNoise(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  dur: number,
  gain: number,
  hp: number
): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, time);
  g.gain.exponentialRampToValueAtTime(MIN, time + dur);
  src.connect(f);
  f.connect(g);
  g.connect(dest);
  src.start(time);
  src.stop(time + dur + 0.02);
}

class MusicEngine {
  private mode: Mode = "menu";
  private intensity = 0;
  private playing = false;
  private currentStep = 0;
  private nextNoteTime = 0;
  private stepDur = stepDurFor("menu");
  private timer: ReturnType<typeof setInterval> | null = null;
  private layers: Record<LayerName, GainNode> | null = null;

  /** Build a gain node per layer (once a context exists), wired to the music bus. */
  private ensureGraph(): boolean {
    if (this.layers) return true;
    const ctx = audioBus.ctx;
    const out = audioBus.musicOut;
    if (!ctx || !out) return false;
    const make = () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(out);
      return g;
    };
    this.layers = {
      melody: make(),
      bass: make(),
      arp: make(),
      kick: make(),
      snare: make(),
      hat: make(),
      cymbal: make(),
      timpani: make(),
    };
    return true;
  }

  /** Crossfade each layer toward the level its (mode, intensity) calls for. */
  private updateLayers(): void {
    const ctx = audioBus.ctx;
    if (!this.layers || !ctx) return;
    const game = this.mode === "game";
    const I = this.intensity;
    const targets: Record<LayerName, number> = {
      melody: 0.5,
      bass: 0.4,
      arp: game ? (I >= 3 ? 0.14 : 0) : 0.16,
      hat: game ? (I >= 2 ? 0.16 : 0) : 0.1,
      kick: game && I >= 1 ? 0.6 : 0,
      snare: game && I >= 2 ? 0.4 : 0,
      cymbal: game && I >= 3 ? 0.26 : 0,
      timpani: game && I >= 1 ? 0.4 : 0,
    };
    const t = ctx.currentTime;
    for (const name of Object.keys(targets) as LayerName[]) {
      const node = this.layers[name];
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(node.gain.value, t);
      node.gain.linearRampToValueAtTime(targets[name], t + 0.18);
    }
  }

  // Schedule every layer's notes for one sixteenth-step at `time`. Layers whose
  // target is 0 are skipped so we don't spawn silent oscillators.
  private scheduleStep(step: number, time: number): void {
    const ctx = audioBus.ctx;
    const L = this.layers;
    if (!ctx || !L) return;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const inBar = step % STEPS_PER_BAR;
    const game = this.mode === "game";
    const I = this.intensity;

    // Melody — soft music-box triangle, constant, on eighth notes.
    if (step % 2 === 0) {
      const name = MELODY[step / 2];
      const f = name ? freq(name) : 0;
      if (f) mTone(ctx, L.melody, f, time, 0.2, "triangle", 0.5);
    }

    // Bass — warm round triangle: root on beat 1, fifth on beat 3.
    if (inBar === 0 || inBar === 8) {
      const name = (inBar === 0 ? BASS_ROOT : BASS_FIFTH)[bar];
      const f = name ? freq(name) : 0;
      if (f) mTone(ctx, L.bass, f, time, 0.3, "triangle", 0.45);
    }

    // Arp — gentle triad. Menu: eighth notes (calm); busy game: sixteenths.
    const arpActive = game ? I >= 3 : true;
    if (arpActive && (game || step % 2 === 0) && bar < ARP.length) {
      const chord = ARP[bar];
      const name = chord ? chord[inBar % 4] : undefined;
      const f = name ? freq(name) : 0;
      if (f) mTone(ctx, L.arp, f, time, 0.16, "triangle", 0.4);
    }

    if (game) {
      // Soft kick on 1 & 3.
      if (I >= 1 && (inBar === 0 || inBar === 8))
        mTone(ctx, L.kick, 130, time, 0.14, "sine", 0.85, 48);
      // Soft "clap" backbeat on 2 & 4 (low-passed, not a bright snare).
      if (I >= 2 && (inBar === 4 || inBar === 12)) {
        mNoise(ctx, L.snare, time, 0.12, 0.26, 1100);
        mTone(ctx, L.snare, 180, time, 0.08, "triangle", 0.14);
      }
      // Gentle wash at the top of bars 1 & 3.
      if (I >= 3 && inBar === 0 && bar % 2 === 0)
        mNoise(ctx, L.cymbal, time, 0.4, 0.16, 1500);
      // Round timpani accent on each downbeat.
      if (I >= 1 && inBar === 0) {
        const name = BASS_ROOT[bar];
        const f = name ? freq(name) : 0;
        if (f) mTone(ctx, L.timpani, f, time, 0.3, "sine", 0.6, f * 0.8);
      }
    }

    // Soft shaker — eighth notes (sixteenths once it's really busy).
    const hatActive = game ? I >= 2 : true;
    const sixteenthHats = game && I >= 4;
    if (hatActive && (sixteenthHats || step % 2 === 0)) {
      const open = inBar === 6 || inBar === 14;
      mNoise(ctx, L.hat, time, open ? 0.06 : 0.025, 0.12, 1900);
    }
  }

  private tick = (): void => {
    const ctx = audioBus.ctx;
    if (!ctx || !this.playing) return;
    if (ctx.state !== "running") {
      audioBus.resume();
      return;
    }
    // Re-sync if we fell behind (tab backgrounded / context was suspended).
    if (this.nextNoteTime < ctx.currentTime)
      this.nextNoteTime = ctx.currentTime + 0.02;
    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      this.scheduleStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += this.stepDur;
      this.currentStep = (this.currentStep + 1) % TOTAL_STEPS;
    }
  };

  /** Start (or switch to) a mode. Safe to call repeatedly; crossfades layers. */
  start(mode: Mode): void {
    this.mode = mode;
    this.stepDur = stepDurFor(mode);
    const ctx = audioBus.ctx;
    if (!ctx) {
      // No Web Audio (e.g. jsdom) — record intent, stay silent.
      this.playing = true;
      return;
    }
    if (!this.ensureGraph()) return;
    if (!this.playing) {
      this.playing = true;
      this.currentStep = 0;
      this.nextNoteTime = ctx.currentTime + 0.06;
      this.timer = setInterval(this.tick, LOOKAHEAD_MS);
    }
    audioBus.resume();
    this.updateLayers();
  }

  /** Set the game intensity (0 = clear, higher = more/stronger enemies). */
  setIntensity(level: number): void {
    const clamped = level < 0 ? 0 : level > 4 ? 4 : Math.round(level);
    if (clamped === this.intensity) return;
    this.intensity = clamped;
    if (this.playing && this.mode === "game") this.updateLayers();
  }

  /** Stop the soundtrack, fading the layers out. */
  stop(): void {
    this.playing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = audioBus.ctx;
    if (!this.layers || !ctx) return;
    const t = ctx.currentTime;
    for (const node of Object.values(this.layers)) {
      node.gain.cancelScheduledValues(t);
      node.gain.setValueAtTime(node.gain.value, t);
      node.gain.linearRampToValueAtTime(0, t + 0.25);
    }
  }
}

export const music = new MusicEngine();

/** Play the calm menu/UI loop. */
export const startMenuMusic = (): void => music.start("menu");
/** Switch to the adaptive in-game loop. */
export const startGameMusic = (): void => music.start("game");
/** Stop the soundtrack (fading out). */
export const stopMusic = (): void => music.stop();
/** Drive the in-game intensity (0 = clear … 4 = mayhem). */
export const setMusicIntensity = (level: number): void =>
  music.setIntensity(level);
