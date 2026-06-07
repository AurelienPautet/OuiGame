/**
 * Low-level procedural synthesis primitives. Each schedules a few short-lived
 * Web Audio nodes on the shared bus and lets them stop themselves — no pooling,
 * no audio files to load. The named sounds in `voices.ts` layer these together.
 */
import { audioBus } from "./AudioBus";

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Random float in [min, max) — used for subtle per-shot pitch variation. */
export const rand = (min: number, max: number): number =>
  min + Math.random() * (max - min);

// One reusable white-noise buffer, cached against the context that owns it (an
// AudioBuffer can't be played on a different context). Rebuilt if the bus ever
// hands us a new context.
let noiseBuf: AudioBuffer | null = null;
let noiseCtx: AudioContext | null = null;
function whiteNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseCtx === ctx) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  noiseCtx = ctx;
  return buf;
}

// Exponential ramps can't reach 0, so envelopes decay to this near-silence.
const MIN_GAIN = 0.0001;

// Wire `node` → (optional stereo pan) → master.
function routeTo(
  ctx: AudioContext,
  node: AudioNode,
  out: AudioNode,
  pan?: number
): void {
  if (pan != null) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    node.connect(panner);
    panner.connect(out);
  } else {
    node.connect(out);
  }
}

export interface ToneOpts {
  /** Start frequency (Hz). */
  freq: number;
  /** Optional glide target (Hz), reached at the end of the sound. */
  freqEnd?: number;
  type?: OscillatorType;
  /** Delay before the sound starts, in seconds. */
  delay?: number;
  /** Total length, in seconds. */
  duration: number;
  /** Peak gain (0..1). */
  gain?: number;
  /** Attack time, in seconds. */
  attack?: number;
  /** Glide curve used for `freqEnd`. */
  glide?: "exp" | "lin";
  /** Stereo position (-1 left .. 1 right). */
  pan?: number;
  detune?: number;
}

/** A single enveloped oscillator, optionally pitch-gliding and panned. */
export function tone(opts: ToneOpts): void {
  const ctx = audioBus.ctx;
  const out = audioBus.out;
  if (!ctx || !out) return;

  const start = ctx.currentTime + (opts.delay ?? 0);
  const end = start + opts.duration;
  const peak = opts.gain ?? 0.3;
  const attack = Math.min(opts.attack ?? 0.005, opts.duration * 0.5);

  const osc = ctx.createOscillator();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.freqEnd != null) {
    const target = Math.max(1, opts.freqEnd);
    if ((opts.glide ?? "exp") === "lin") {
      osc.frequency.linearRampToValueAtTime(target, end);
    } else {
      osc.frequency.exponentialRampToValueAtTime(target, end);
    }
  }
  if (opts.detune != null) osc.detune.setValueAtTime(opts.detune, start);

  const env = ctx.createGain();
  env.gain.setValueAtTime(MIN_GAIN, start);
  env.gain.exponentialRampToValueAtTime(peak, start + attack);
  env.gain.exponentialRampToValueAtTime(MIN_GAIN, end);

  osc.connect(env);
  routeTo(ctx, env, out, opts.pan);
  osc.start(start);
  osc.stop(end + 0.03);
}

export interface NoiseOpts {
  delay?: number;
  duration: number;
  gain?: number;
  attack?: number;
  /** Biquad shaping the burst (lowpass/highpass/bandpass). */
  filter?: BiquadFilterType;
  /** Filter start frequency (Hz). */
  freq?: number;
  /** Filter glide target (Hz). */
  freqEnd?: number;
  /** Filter resonance. */
  q?: number;
  pan?: number;
}

/** An enveloped white-noise burst through an optional sweeping filter. */
export function noise(opts: NoiseOpts): void {
  const ctx = audioBus.ctx;
  const out = audioBus.out;
  if (!ctx || !out) return;

  const start = ctx.currentTime + (opts.delay ?? 0);
  const end = start + opts.duration;
  const peak = opts.gain ?? 0.3;
  const attack = Math.min(opts.attack ?? 0.002, opts.duration * 0.5);

  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  src.loop = true;

  const env = ctx.createGain();
  env.gain.setValueAtTime(MIN_GAIN, start);
  env.gain.exponentialRampToValueAtTime(peak, start + attack);
  env.gain.exponentialRampToValueAtTime(MIN_GAIN, end);

  if (opts.filter) {
    const f = ctx.createBiquadFilter();
    f.type = opts.filter;
    f.frequency.setValueAtTime(opts.freq ?? 1000, start);
    if (opts.freqEnd != null) {
      f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), end);
    }
    if (opts.q != null) f.Q.setValueAtTime(opts.q, start);
    src.connect(f);
    f.connect(env);
  } else {
    src.connect(env);
  }

  routeTo(ctx, env, out, opts.pan);
  src.start(start);
  src.stop(end + 0.03);
}
