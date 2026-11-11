/**
 * MusicEngine — the adaptive, fully procedural soundtrack.
 *
 * The composition lives in `score.ts` (Tonal chord progressions + a seeded
 * melody generator, and the Wii Tanks! stem chart); this file is the
 * instrument/mix layer. Tone.js synths replace the old bare oscillators, and a
 * small effects chain (low-pass → chorus → delay → convolution reverb) gives
 * the soundtrack a produced, warm character. The reverb impulse is generated at
 * runtime, so there are still no audio assets to download.
 *
 * The game drives the *arrangement*: `GameEngine` periodically reports which
 * enemy tanks are alive, and `setMusicTanks` maps them onto the stem chart.
 * The strongest tank alive picks the set of stems, with extra stems unlocking
 * as more tanks survive — exactly the system in Wii Play's Tanks!. Changes are
 * quantised to the next bar so stems enter and leave on the beat instead of
 * crossfading mid-phrase.
 */
import type * as ToneNS from "tone";
import { audioBus } from "./AudioBus";
import {
  LAYER_NAMES,
  MENU_LAYERS,
  STEPS_PER_BAR,
  buildScore,
  eventsForStep,
  layersForTanks,
  midiToFreq,
  type LayerName,
  type MusicMode,
  type Score,
  type StepEvent,
} from "./score";
import { getTone } from "./tone";

const MENU_SEED = 0x51ce;

interface Voices {
  /** Flute — the always-present basic track. */
  melody: ToneNS.PolySynth<ToneNS.FMSynth>;
  /** Tuba. */
  bass: ToneNS.MonoSynth;
  /** Tubular bells. */
  bells: ToneNS.PolySynth<ToneNS.FMSynth>;
  /** Synthesizer arpeggio. */
  synth: ToneNS.PolySynth<ToneNS.Synth>;
  /** Bass drum. */
  kick: ToneNS.MembraneSynth;
  snareNoise: ToneNS.NoiseSynth;
  snareBody: ToneNS.MembraneSynth;
  /** Metronome tick. */
  metronome: ToneNS.NoiseSynth;
  cymbal: ToneNS.NoiseSynth;
  /** Low timpani. */
  timpaniA: ToneNS.MembraneSynth;
  /** High timpani. */
  timpaniB: ToneNS.MembraneSynth;
}

const sameLayers = (a: ReadonlySet<LayerName>, b: readonly LayerName[]) =>
  a.size === b.length && b.every((layer) => a.has(layer));

class MusicEngine {
  private mode: MusicMode = "menu";
  private playing = false;
  private step = 0;
  private score: Score = buildScore("menu", MENU_SEED);
  private layers: Record<LayerName, ToneNS.Gain> | null = null;
  private voices: Voices | null = null;
  /** Stems currently sounding. */
  private active: Set<LayerName> = new Set(MENU_LAYERS);
  /** Arrangement waiting for the next bar line. */
  private pending: LayerName[] | null = null;

  /** Build the Tone graph once, sharing the bus context. */
  private ensureGraph(): boolean {
    if (this.layers && this.voices) return true;
    const T = getTone();
    const out = audioBus.musicOut;
    if (!T || !out) return false;

    const outGain = new T.Gain(0.9).connect(out);
    const bus = new T.Gain(0.85);
    const filter = new T.Filter({ type: "lowpass", frequency: 9500, Q: 0.3 });
    const chorus = new T.Chorus({
      frequency: 0.55,
      delayTime: 3.2,
      depth: 0.22,
      wet: 0.18,
    }).start();
    const delay = new T.FeedbackDelay({
      delayTime: "8n.",
      feedback: 0.16,
      wet: 0.1,
    });
    const reverb = new T.Reverb({ decay: 2.8, preDelay: 0.015, wet: 0.22 });
    bus.chain(filter, chorus, delay, reverb, outGain);

    const layer = (): ToneNS.Gain => {
      const gain = new T.Gain(0);
      gain.connect(bus);
      return gain;
    };
    const layers = Object.fromEntries(
      LAYER_NAMES.map((name) => [name, layer()])
    ) as Record<LayerName, ToneNS.Gain>;

    // Flute — a soft, breathy sine lead. Kept pure so the basic track can sit
    // alone under the opening of a round without feeling thin.
    const melody = new T.PolySynth(T.FMSynth, {
      harmonicity: 2,
      modulationIndex: 2.8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.03, decay: 0.18, sustain: 0.24, release: 0.3 },
      modulation: { type: "triangle" },
      modulationEnvelope: {
        attack: 0.08,
        decay: 0.2,
        sustain: 0.12,
        release: 0.3,
      },
    }).connect(layers.melody);
    melody.volume.value = -8;

    // Tuba — a round, brassy low end with a fast filter bloom.
    const bass = new T.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { type: "lowpass", Q: 1.4, rolloff: -24 },
      envelope: { attack: 0.02, decay: 0.26, sustain: 0.2, release: 0.3 },
      filterEnvelope: {
        attack: 0.015,
        decay: 0.2,
        sustain: 0.15,
        release: 0.3,
        baseFrequency: 90,
        octaves: 2.2,
      },
    }).connect(layers.bass);
    bass.volume.value = -7;

    // Tubular bells — long, inharmonic FM ring for the high punctuation.
    const bells = new T.PolySynth(T.FMSynth, {
      harmonicity: 3.5,
      modulationIndex: 8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.002, decay: 1.1, sustain: 0.04, release: 1.3 },
      modulation: { type: "sine" },
      modulationEnvelope: {
        attack: 0.002,
        decay: 0.6,
        sustain: 0,
        release: 0.8,
      },
    }).connect(layers.bells);
    bells.volume.value = -14;

    // Synthesizer — a bright but reined-in saw arpeggio.
    const synth = new T.PolySynth(T.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.004, decay: 0.12, sustain: 0.05, release: 0.14 },
    }).connect(layers.synth);
    synth.volume.value = -19;

    const kick = new T.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.22, sustain: 0.01, release: 0.1 },
    }).connect(layers.kick);
    kick.volume.value = -4;

    const snareNoise = new T.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
    }).connect(layers.snare);
    snareNoise.volume.value = -10;

    const snareBody = new T.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0.01, release: 0.06 },
    }).connect(layers.snare);
    snareBody.volume.value = -12;

    // Metronome — a dry, high tick: noise through a steep high-pass.
    const metronomeFilter = new T.Filter({ type: "highpass", frequency: 2800 });
    const metronome = new T.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.018, sustain: 0 },
    }).chain(metronomeFilter, layers.metronome);
    metronome.volume.value = -17;

    const cymbalFilter = new T.Filter({
      type: "highpass",
      frequency: 4500,
    });
    const cymbal = new T.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.002, decay: 0.5, sustain: 0 },
    }).chain(cymbalFilter, layers.cymbal);
    cymbal.volume.value = -18;

    // Timpani A/B — low and high drums; B is shorter and brighter so the two
    // patterns read as a call and an answer.
    const timpaniA = new T.MembraneSynth({
      pitchDecay: 0.12,
      octaves: 3.5,
      envelope: { attack: 0.002, decay: 0.4, sustain: 0.05, release: 0.5 },
    }).connect(layers.timpaniA);
    timpaniA.volume.value = -8;

    const timpaniB = new T.MembraneSynth({
      pitchDecay: 0.07,
      octaves: 3,
      envelope: { attack: 0.002, decay: 0.28, sustain: 0.03, release: 0.3 },
    }).connect(layers.timpaniB);
    timpaniB.volume.value = -10;

    this.layers = layers;
    this.voices = {
      melody,
      bass,
      bells,
      synth,
      kick,
      snareNoise,
      snareBody,
      metronome,
      cymbal,
      timpaniA,
      timpaniB,
    };

    const transport = T.getTransport();
    transport.bpm.value = this.score.bpm;
    transport.swing = 0.02;
    transport.swingSubdivision = "8n";
    transport.scheduleRepeat((time) => this.onStep(time), "16n");
    return true;
  }

  /**
   * Ramp every stem's gain toward the current arrangement. Passing `at` (an
   * audio-clock time) finishes the ramp exactly there, so callers can prepare a
   * change to be complete on a bar line.
   */
  private updateLayers(seconds = 0.35, at?: number): void {
    const T = getTone();
    if (!this.layers || !T) return;
    const now = T.getContext().currentTime;
    const end = at === undefined ? now + seconds : at;
    const start = Math.max(now, end - seconds);
    const duration = Math.max(0.01, end - start);
    for (const name of LAYER_NAMES) {
      const gain = this.layers[name].gain;
      const target = this.active.has(name) ? 1 : 0;
      gain.cancelScheduledValues(start);
      gain.setValueAtTime(gain.value, start);
      gain.linearRampToValueAtTime(target, start + duration);
    }
  }

  /** Adopt an arrangement now (used on start and at bar lines). */
  private applyArrangement(
    next: readonly LayerName[],
    seconds = 0.35,
    at?: number
  ): void {
    this.active = new Set(next);
    this.pending = null;
    this.updateLayers(seconds, at);
  }

  private trigger(event: StepEvent, time: number): void {
    const voices = this.voices;
    if (!voices) return;
    switch (event.layer) {
      case "melody":
        voices.melody.triggerAttackRelease(
          midiToFreq(event.midi),
          event.duration,
          time,
          event.velocity
        );
        break;
      case "bass":
        voices.bass.triggerAttackRelease(
          midiToFreq(event.midi),
          event.duration,
          time,
          event.velocity
        );
        break;
      case "bells":
        voices.bells.triggerAttackRelease(
          midiToFreq(event.midi),
          event.duration,
          time,
          event.velocity
        );
        break;
      case "synth":
        voices.synth.triggerAttackRelease(
          midiToFreq(event.midi),
          event.duration,
          time,
          event.velocity
        );
        break;
      case "timpaniA":
        voices.timpaniA.triggerAttackRelease(
          midiToFreq(event.midi),
          event.duration,
          time,
          event.velocity
        );
        break;
      case "timpaniB":
        voices.timpaniB.triggerAttackRelease(
          midiToFreq(event.midi),
          event.duration,
          time,
          event.velocity
        );
        break;
      case "kick":
        voices.kick.triggerAttackRelease(
          55,
          event.duration,
          time,
          event.velocity
        );
        break;
      case "snare":
        voices.snareNoise.triggerAttackRelease(
          event.duration,
          time,
          event.velocity
        );
        voices.snareBody.triggerAttackRelease(
          180,
          0.06,
          time,
          event.velocity * 0.5
        );
        break;
      case "metronome":
        voices.metronome.triggerAttackRelease(
          event.duration,
          time,
          event.velocity
        );
        break;
      case "cymbal":
        voices.cymbal.triggerAttackRelease(
          event.duration,
          time,
          event.velocity
        );
        break;
    }
  }

  /** Transport callback: schedule one sixteenth, then advance. */
  private onStep(time: number): void {
    if (!this.playing) return;
    // Stem changes land on the bar line, never mid-phrase, and the crossfade is
    // finished *by* the downbeat so the incoming stem's first accent is heard.
    if (this.pending && this.step % STEPS_PER_BAR === 0) {
      this.applyArrangement(this.pending, 0.25, time);
    }
    const events = eventsForStep(this.score, this.step, this.active);
    for (const event of events) this.trigger(event, time);
    this.step = (this.step + 1) % this.score.totalSteps;
  }

  /** Start (or switch to) a mode. Safe to call repeatedly; crossfades layers. */
  start(mode: MusicMode): void {
    const T = getTone();
    this.mode = mode;
    if (!T) {
      // No Web Audio (jsdom) — record intent, stay silent.
      this.playing = true;
      return;
    }
    if (!this.ensureGraph()) return;

    const changed = this.score.mode !== mode || !this.playing;
    if (changed) {
      const seed =
        mode === "game" ? Math.floor(Math.random() * 0xffffffff) : MENU_SEED;
      this.score = buildScore(mode, seed);
      this.step = 0;
      this.applyArrangement(mode === "game" ? ["melody"] : MENU_LAYERS, 0.06);
    }
    this.playing = true;

    const transport = T.getTransport();
    transport.bpm.value = this.score.bpm;
    transport.swing = mode === "game" ? 0.05 : 0.02;
    if (changed && transport.state === "started") {
      transport.stop();
      transport.position = 0;
    }
    if (transport.state !== "started") {
      transport.position = 0;
      transport.start("+0.06");
    }

    audioBus.resume();
    this.updateLayers();
  }

  /**
   * Report the living enemy tanks (their colours/kinds). The engine picks the
   * chart row for the strongest one and queues the stem change for the next bar.
   * Ignored outside game mode so menu music can't be rearranged by stale data.
   */
  setTanks(tanks: readonly string[]): void {
    if (this.mode !== "game") return;
    const next = layersForTanks(tanks);
    if (sameLayers(this.active, next)) {
      this.pending = null;
      return;
    }
    if (!this.playing) {
      this.applyArrangement(next, 0.06);
      return;
    }
    // If we're sitting exactly on a bar line, apply immediately; otherwise the
    // next `onStep` at step 0 picks it up.
    if (this.step % STEPS_PER_BAR === 0) this.applyArrangement(next);
    else this.pending = next;
  }

  /** Stop the soundtrack, fading every stem out. */
  stop(): void {
    this.playing = false;
    this.step = 0;
    this.pending = null;
    const T = getTone();
    if (!T || !this.layers) return;
    T.getTransport().stop();
    T.getTransport().position = 0;
    this.active = new Set();
    this.updateLayers(0.25);
  }
}

export const music = new MusicEngine();

/** Play the calm menu/UI loop. */
export const startMenuMusic = (): void => music.start("menu");
/** Switch to the adaptive in-game loop. */
export const startGameMusic = (): void => music.start("game");
/** Stop the soundtrack (fading out). */
export const stopMusic = (): void => music.stop();
/** Report the living enemy tanks so the arrangement follows the fight. */
export const setMusicTanks = (tanks: readonly string[]): void =>
  music.setTanks(tanks);
