/**
 * Procedural score generation.
 *
 * Pure music theory + note scheduling data: no Web Audio, no DOM. The Tone
 * engine in `music.ts` reads these events on every sixteenth step. Keeping the
 * composition here means it can be unit-tested in jsdom and re-used by a
 * future editor/DAW export.
 *
 * The harmonic content comes from Tonal (chord voicings and MIDI notes); the
 * melodic material is a seeded random walk that favours chord tones on strong
 * beats and stepwise motion everywhere else. Different seeds produce different
 * phrases while the chord grid stays fixed.
 *
 * The arrangement — which stems are audible — is not a function of a generic
 * "intensity" dial. It follows the adaptive system of Wii Play's Tanks! (as
 * charted by BigKitty1011 and explained in Scruffy's video): the soundtrack is
 * one loop, and the strongest enemy tank alive selects a set of stems, with
 * extra stems unlocking as more tanks share the field. See `layersForTanks`.
 */
import { Chord, Note } from "@tonaljs/tonal";

export type MusicMode = "menu" | "game";

/**
 * One stem of the arrangement. Names map 1:1 onto the instruments in the Wii
 * Tanks! chart:
 *
 * | layer      | chart stem     |
 * | ---------- | -------------- |
 * | `melody`   | Flute (basic)  |
 * | `snare`    | Snare drum     |
 * | `metronome`| Metronome      |
 * | `cymbal`   | Cymbals        |
 * | `kick`     | Bass drum      |
 * | `bass`     | Tuba           |
 * | `bells`    | Tubular bells  |
 * | `synth`    | Synthesizer    |
 * | `timpaniA` | Timpani A      |
 * | `timpaniB` | Timpani B      |
 */
export type LayerName =
  | "melody"
  | "snare"
  | "metronome"
  | "cymbal"
  | "kick"
  | "bass"
  | "bells"
  | "synth"
  | "timpaniA"
  | "timpaniB";

/** Order used when ramping gains, so iteration is deterministic. */
export const LAYER_NAMES: readonly LayerName[] = [
  "melody",
  "bass",
  "bells",
  "synth",
  "metronome",
  "snare",
  "kick",
  "cymbal",
  "timpaniA",
  "timpaniB",
];

export const STEPS_PER_BAR = 16;
export const BARS = 8;
export const TOTAL_STEPS = STEPS_PER_BAR * BARS;

/** Eight eighth-note melody slots per bar (one every other sixteenth). */
const SLOTS_PER_BAR = 8;

export const BPM: Record<MusicMode, number> = { menu: 80, game: 104 };

export interface Score {
  mode: MusicMode;
  seed: number;
  bpm: number;
  /** Number of sixteenth steps in one pass of the loop. */
  totalSteps: number;
  /** One chord name per bar. */
  chords: string[];
  /** Ascending chord voicing per bar (MIDI, octave 3–4). */
  chordTones: number[][];
  /** Melody per eighth-note slot; null = rest. */
  melody: (number | null)[];
  /** Bass root per bar (octave 1–2). */
  bass: number[];
  /** Bass fifth per bar. */
  fifth: number[];
  /** Arpeggio notes per bar (octave 4–5). */
  arp: number[][];
  /** Low timpani note per bar. */
  timpani: number[];
  /** High timpani note per bar (a fifth above the low drum). */
  timpaniHigh: number[];
}

export interface NoteStepEvent {
  layer: "melody" | "bass" | "bells" | "synth" | "timpaniA" | "timpaniB";
  midi: number;
  duration: number;
  velocity: number;
}

export interface DrumStepEvent {
  layer: "kick" | "snare" | "metronome" | "cymbal";
  duration: number;
  velocity: number;
}

export type StepEvent = NoteStepEvent | DrumStepEvent;

// Menu stays on the classic I–vi–IV–V; a round leans on I–V–vi–IV, which has
// more forward motion without leaving C major. Chord symbols are written out
// because Tonal's Roman-numeral parser does not preserve minor quality.
const PROGRESSIONS: Record<MusicMode, string[]> = {
  menu: ["C", "Am", "F", "G"],
  game: ["C", "G", "Am", "F"],
};

const SCALE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81];

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Small, fast, deterministic PRNG — same seed, same soundtrack. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** MIDI note → frequency in Hz (A4 = 69 = 440 Hz). */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Build an ascending close-position voicing for a chord, rooted in octave 3. */
export function chordVoicing(name: string): number[] {
  const notes = Chord.get(name).notes;
  const voicing: number[] = [];
  for (const pitchClass of notes) {
    let midi = Note.midi(`${pitchClass}3`) ?? 48;
    while (voicing.length > 0 && midi <= voicing[voicing.length - 1]!) {
      midi += 12;
    }
    voicing.push(midi);
  }
  return voicing;
}

/** Roots around C2–G2; A and B drop to octave 1 to stay in the same pocket. */
export function bassNote(rootMidi: number): number {
  let midi = rootMidi - 12;
  while (midi > 43) midi -= 12;
  return midi;
}

/** Every chord tone across the melody register (C4–A5). */
function melodyPool(voicing: number[]): number[] {
  const pool: number[] = [];
  for (const note of voicing) {
    for (let midi = note; midi <= 81; midi += 12) {
      if (midi >= 60) pool.push(midi);
    }
  }
  return [...new Set(pool)].sort((a, b) => a - b);
}

function nearest(pool: number[], target: number): number {
  let best = pool[0] ?? target;
  for (const note of pool) {
    if (Math.abs(note - target) < Math.abs(best - target)) best = note;
  }
  return best;
}

/** Move a scale step or two from `prev`; falls back to a chromatic clamp. */
function scaleStep(prev: number, delta: number): number {
  const index = SCALE.indexOf(prev);
  if (index < 0) return prev;
  const next = index + delta;
  if (next < 0 || next >= SCALE.length) return prev;
  return SCALE[next]!;
}

/**
 * Generate two bars (16 eighth-note slots) of melody over `startBar`/`startBar+1`.
 * Strong beats are chord tones; weak beats walk the scale with occasional rests.
 */
function phrase(
  chordTones: number[][],
  rng: () => number,
  startBar: number,
  startNote: number,
  endOnRoot: boolean
): (number | null)[] {
  const slots: (number | null)[] = [];
  let prev = startNote;

  for (let offset = 0; offset < 2; offset++) {
    const bar = startBar + offset;
    const voicing = chordTones[bar] ?? chordTones[0] ?? [48, 52, 55];
    const pool = melodyPool(voicing);
    const rootPitch = (voicing[0] ?? 48) % 12;
    const rootPool = pool.filter((n) => n % 12 === rootPitch);

    for (let slot = 0; slot < SLOTS_PER_BAR; slot++) {
      const index = offset * SLOTS_PER_BAR + slot;
      const strong = slot === 0 || slot === 4;
      const last = index === SLOTS_PER_BAR * 2 - 1;

      if (last) {
        const note = nearest(endOnRoot ? rootPool : pool, prev);
        slots.push(note);
        prev = note;
        continue;
      }

      // Leave a little air off the beat, but never on beat one.
      if (!strong && rng() < 0.14) {
        slots.push(null);
        continue;
      }

      let note: number;
      if (strong) {
        const lift = slot === 0 ? 2 : 0;
        const target = prev + lift + (rng() < 0.5 ? -2 : 2);
        note = nearest(pool, target);
      } else {
        const delta =
          rng() < 0.7 ? (rng() < 0.5 ? -1 : 1) : rng() < 0.5 ? -2 : 2;
        note = scaleStep(prev, delta);
        // Don't let the walk drift too far from the current harmony.
        if (Math.abs(note - nearest(pool, note)) > 4)
          note = nearest(pool, note);
      }

      while (note < 60) note += 12;
      while (note > 81) note -= 12;
      slots.push(note);
      prev = note;
    }
  }

  return slots;
}

/**
 * Build an eight-bar score: a two-bar question/answer pair, then a varied
 * repeat that cadences on the dominant so the loop turns over naturally.
 */
export function buildScore(mode: MusicMode, seed: number): Score {
  const rng = mulberry32(seed);
  const base = PROGRESSIONS[mode];
  const chords = [...base, ...base];
  const chordTones = chords.map(chordVoicing);

  const first = phrase(chordTones, rng, 0, 67, false);
  const second = phrase(
    chordTones,
    rng,
    2,
    first[first.length - 1] ?? 67,
    true
  );

  // The repeat lifts its opening note an octave for a bit of lift, then
  // answers with a fresh phrase that ends on the dominant.
  const repeat = first.map((note, index) =>
    index === 0 && note != null && note + 12 <= 81 ? note + 12 : note
  );
  const answer = phrase(
    chordTones,
    rng,
    6,
    repeat[repeat.length - 1] ?? 67,
    true
  );

  const roots = chordTones.map((voicing) => bassNote(voicing[0] ?? 48));

  return {
    mode,
    seed,
    bpm: BPM[mode],
    totalSteps: TOTAL_STEPS,
    chords,
    chordTones,
    melody: [...first, ...second, ...repeat, ...answer],
    bass: roots,
    fifth: roots.map((root) => root + 7),
    arp: chordTones.map((voicing) => {
      const root = voicing[0] ?? 48;
      return [...voicing.map((note) => note + 12), root + 24];
    }),
    timpani: roots.map((root) => root + 12),
    timpaniHigh: roots.map((root) => root + 19),
  };
}

// ---------------------------------------------------------------------------
// The tank → stem chart
// ---------------------------------------------------------------------------

/** The nine Wii tank kinds, in the game's own naming. */
export type TankKind =
  | "match"
  | "brown"
  | "grey"
  | "teal"
  | "pink"
  | "yellow"
  | "purple"
  | "green"
  | "white"
  | "black";

/**
 * Priority, least → most. Only the strongest tank alive picks the arrangement
 * (the chart's "greater priority replaces lesser"), while the *total* number of
 * surviving tanks chooses that tank's tier.
 *
 * `match` sits below brown: it is this game's fallback for player tanks in an
 * all-human FFA, where there is no Wii tank kind to read, so it simply grows
 * with the number of opponents.
 */
export const TANK_PRIORITY: readonly TankKind[] = [
  "match",
  "brown",
  "grey",
  "teal",
  "pink",
  "yellow",
  "purple",
  "green",
  "white",
  "black",
];

const PRIORITY_INDEX: Record<TankKind, number> = TANK_PRIORITY.reduce(
  (acc, kind, index) => {
    acc[kind] = index;
    return acc;
  },
  {} as Record<TankKind, number>
);

interface TankTier {
  /** Minimum number of enemy tanks alive for this tier. */
  minTanks: number;
  layers: readonly LayerName[];
}

/**
 * BigKitty1011's corrected chart (the one the video's pinned correction links
 * to). Each row is the set of stems that plays while that kind is the strongest
 * tank alive, at the given survivor count. Everything not listed is silent.
 */
const TANK_CHART: Record<TankKind, readonly TankTier[]> = {
  // Not part of the Wii chart: an all-human FFA has no enemy tank kinds, so the
  // opponents themselves build a plain groove, one layer per survivor.
  match: [
    { minTanks: 1, layers: ["melody", "snare"] },
    { minTanks: 2, layers: ["melody", "snare", "metronome", "cymbal"] },
    {
      minTanks: 3,
      layers: ["melody", "snare", "metronome", "cymbal", "kick", "bass"],
    },
    {
      minTanks: 4,
      layers: [
        "melody",
        "snare",
        "metronome",
        "cymbal",
        "kick",
        "bass",
        "bells",
        "synth",
      ],
    },
    {
      minTanks: 5,
      layers: [
        "melody",
        "snare",
        "metronome",
        "cymbal",
        "kick",
        "bass",
        "bells",
        "synth",
        "timpaniB",
      ],
    },
  ],
  brown: [{ minTanks: 1, layers: ["melody", "snare"] }],
  grey: [
    { minTanks: 1, layers: ["melody", "snare", "metronome"] },
    { minTanks: 3, layers: ["melody", "snare", "metronome", "timpaniA"] },
  ],
  teal: [
    {
      minTanks: 1,
      layers: ["melody", "metronome", "cymbal", "timpaniA"],
    },
    {
      minTanks: 2,
      layers: ["melody", "snare", "metronome", "cymbal", "timpaniA"],
    },
    {
      minTanks: 4,
      layers: ["melody", "snare", "metronome", "cymbal", "timpaniB"],
    },
  ],
  pink: [
    { minTanks: 1, layers: ["melody", "snare", "timpaniB"] },
    { minTanks: 2, layers: ["melody", "snare", "cymbal", "timpaniB"] },
    {
      minTanks: 3,
      layers: ["melody", "snare", "metronome", "cymbal", "timpaniB"],
    },
  ],
  yellow: [
    {
      minTanks: 1,
      layers: ["melody", "metronome", "cymbal", "kick", "timpaniA"],
    },
    {
      minTanks: 2,
      layers: ["melody", "snare", "metronome", "cymbal", "kick", "timpaniA"],
    },
    {
      minTanks: 3,
      layers: ["melody", "snare", "metronome", "cymbal", "kick", "timpaniB"],
    },
  ],
  purple: [
    { minTanks: 1, layers: ["melody", "cymbal", "bass", "timpaniA"] },
    {
      minTanks: 2,
      layers: ["melody", "snare", "cymbal", "kick", "bass", "timpaniA"],
    },
    {
      minTanks: 3,
      layers: [
        "melody",
        "snare",
        "metronome",
        "cymbal",
        "kick",
        "bass",
        "timpaniB",
      ],
    },
  ],
  green: [
    { minTanks: 1, layers: ["melody", "cymbal", "bass", "bells", "timpaniA"] },
    {
      minTanks: 2,
      layers: ["melody", "cymbal", "kick", "bass", "bells", "timpaniA"],
    },
    {
      minTanks: 3,
      layers: [
        "melody",
        "snare",
        "metronome",
        "cymbal",
        "kick",
        "bass",
        "bells",
        "timpaniA",
      ],
    },
    {
      minTanks: 4,
      layers: [
        "melody",
        "snare",
        "metronome",
        "cymbal",
        "kick",
        "bass",
        "bells",
        "timpaniB",
      ],
    },
  ],
  white: [
    { minTanks: 1, layers: ["melody", "snare", "bass", "synth", "timpaniA"] },
    {
      minTanks: 2,
      layers: [
        "melody",
        "snare",
        "metronome",
        "kick",
        "bass",
        "synth",
        "timpaniB",
      ],
    },
    {
      minTanks: 3,
      layers: [
        "melody",
        "snare",
        "metronome",
        "cymbal",
        "kick",
        "bass",
        "synth",
        "timpaniB",
      ],
    },
  ],
  black: [
    {
      minTanks: 1,
      layers: [
        "melody",
        "metronome",
        "cymbal",
        "kick",
        "bass",
        "bells",
        "synth",
        "timpaniB",
      ],
    },
  ],
};

/**
 * Colour/kind names the game actually carries on a tank (`turretc`, and the
 * `kind` ids bots spawn with) mapped onto the chart's tank kinds.
 */
const TANK_ALIASES: Record<string, TankKind> = {
  brown: "brown",
  grey: "grey",
  gray: "grey",
  dimgray: "grey",
  teal: "teal",
  turquoise: "teal",
  pink: "pink",
  magenta: "pink",
  red: "pink",
  yellow: "yellow",
  purple: "purple",
  violet: "purple",
  green: "green",
  white: "white",
  black: "black",
  // Player-tank paints that aren't one of the nine kinds.
  match: "match",
  blue: "match",
  orange: "match",
  bluef: "match",
  bot1: "brown",
  bot2: "grey",
  bot3: "teal",
  bot4: "green",
  bot5: "yellow",
  bot6: "purple",
  bot7: "pink",
  bot8: "white",
  bot9: "black",
};

/** Map any tank colour/kind to a chart kind; unknown paint falls back to match. */
export function tankKindFrom(value: string | undefined): TankKind {
  if (!value) return "match";
  return TANK_ALIASES[value.trim().toLowerCase()] ?? "match";
}

/**
 * The stems that should be audible for the living enemy tanks.
 *
 * The strongest tank present (per `TANK_PRIORITY`) owns the arrangement, and
 * the total survivor count selects its tier. An empty field leaves just the
 * flute/basic track. The result is order-independent and stable, so the caller
 * can compare it against the currently playing set to detect a real change.
 */
export function layersForTanks(tanks: readonly string[]): LayerName[] {
  if (tanks.length === 0) return ["melody"];

  let strongest = tankKindFrom(tanks[0]);
  for (const tank of tanks) {
    const kind = tankKindFrom(tank);
    if (PRIORITY_INDEX[kind] > PRIORITY_INDEX[strongest]) strongest = kind;
  }

  const tiers = TANK_CHART[strongest];
  let tier = tiers[0]!;
  for (const candidate of tiers) {
    if (tanks.length >= candidate.minTanks) tier = candidate;
  }
  return [...tier.layers];
}

/** The menu loop: the basic track plus a calm synth/bell/tuba pad. */
export const MENU_LAYERS: readonly LayerName[] = [
  "melody",
  "bass",
  "bells",
  "synth",
];

/** Tiny deterministic value in [-1, 1) used to humanise velocities. */
function jitter(seed: number, step: number): number {
  let h = seed ^ Math.imul(step + 1, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (((h ^ (h >>> 16)) >>> 0) / 0xffffffff) * 2 - 1;
}

/**
 * The notes/percussion for one sixteenth step, given the currently audible
 * stems. Pure, so the chart mapping and every stem's pattern can be tested
 * without an AudioContext.
 */
export function eventsForStep(
  score: Score,
  step: number,
  layers: ReadonlySet<LayerName>
): StepEvent[] {
  const bar = Math.floor(step / STEPS_PER_BAR) % BARS;
  const inBar = step % STEPS_PER_BAR;
  const events: StepEvent[] = [];
  const human = jitter(score.seed, step);
  const chord = score.arp[bar] ?? [];

  // Flute — the basic track: the melody every eighth, with a touch of movement.
  // The chart's basic-track icon is a pair of flutes, so each phrase note is
  // doubled a diatonic third below at a softer level.
  if (layers.has("melody") && inBar % 2 === 0) {
    const midi = score.melody[bar * SLOTS_PER_BAR + inBar / 2];
    if (midi != null) {
      const accent = inBar === 0 ? 0.08 : 0;
      const velocity = clamp01(0.5 + accent + human * 0.035);
      events.push({
        layer: "melody",
        midi,
        duration: 0.26,
        velocity,
      });
      const harmony = scaleStep(midi, -2);
      if (harmony !== midi && harmony >= 55) {
        events.push({
          layer: "melody",
          midi: harmony,
          duration: 0.24,
          velocity: clamp01(velocity * 0.6),
        });
      }
    }
  }

  // Tuba — root on beat 1, fifth on beat 3, plus a short push into the next bar.
  if (layers.has("bass")) {
    if (inBar === 0) {
      events.push({
        layer: "bass",
        midi: score.bass[bar] ?? 36,
        duration: 0.34,
        velocity: 0.62,
      });
    } else if (inBar === 8) {
      events.push({
        layer: "bass",
        midi: score.fifth[bar] ?? 43,
        duration: 0.3,
        velocity: 0.55,
      });
    } else if (inBar === 14) {
      events.push({
        layer: "bass",
        midi: score.bass[bar] ?? 36,
        duration: 0.12,
        velocity: 0.42,
      });
    }
  }

  // Tubular bells — sparse, ringing off-beat punctuation high above the melody.
  if (layers.has("bells") && (inBar === 2 || inBar === 10)) {
    const midi =
      chord[(bar + (inBar === 10 ? 1 : 0)) % Math.max(1, chord.length)];
    if (midi != null) {
      events.push({
        layer: "bells",
        midi: midi + 12,
        duration: 0.6,
        velocity: clamp01(0.26 + human * 0.02),
      });
    }
  }

  // Synthesizer — a steady eighth-note arpeggio through the chord.
  if (layers.has("synth") && inBar % 2 === 0 && chord.length > 0) {
    const midi = chord[(inBar / 2 + bar) % chord.length];
    if (midi != null) {
      events.push({
        layer: "synth",
        midi,
        duration: 0.12,
        velocity: clamp01(0.3 + human * 0.02),
      });
    }
  }

  // Metronome — a dry quarter-note tick, accented on the downbeat.
  if (layers.has("metronome") && inBar % 4 === 0) {
    events.push({
      layer: "metronome",
      duration: 0.02,
      velocity: inBar === 0 ? 0.28 : 0.2,
    });
  }

  // Snare — backbeat on 2 & 4, with a small fill at the end of every fourth bar.
  if (layers.has("snare")) {
    if (inBar === 4 || inBar === 12) {
      events.push({ layer: "snare", duration: 0.12, velocity: 0.55 });
    }
    if (bar % 4 === 3 && (inBar === 14 || inBar === 15)) {
      events.push({
        layer: "snare",
        duration: 0.1,
        velocity: 0.35 + (inBar - 14) * 0.1,
      });
    }
  }

  // Bass drum — 1 & 3, with a syncopated push before the turnaround.
  if (layers.has("kick")) {
    if (inBar === 0 || inBar === 8) {
      events.push({
        layer: "kick",
        duration: 0.18,
        velocity: inBar === 0 ? 0.82 : 0.68,
      });
    }
    if (inBar === 14) {
      events.push({ layer: "kick", duration: 0.1, velocity: 0.4 });
    }
  }

  // Cymbals — a wash at the top of alternate bars, brushed on the off bars.
  if (layers.has("cymbal")) {
    if (inBar === 0 && bar % 2 === 0) {
      events.push({ layer: "cymbal", duration: 0.5, velocity: 0.3 });
    } else if (inBar === 8 && bar % 2 === 1) {
      events.push({ layer: "cymbal", duration: 0.3, velocity: 0.18 });
    }
  }

  // Timpani A — the low drum on the downbeat, plus a pickup into the phrase end.
  if (layers.has("timpaniA")) {
    if (inBar === 0) {
      events.push({
        layer: "timpaniA",
        midi: score.timpani[bar] ?? 48,
        duration: 0.35,
        velocity: 0.6,
      });
    }
    if (bar % 4 === 3 && inBar === 8) {
      events.push({
        layer: "timpaniA",
        midi: score.timpani[bar] ?? 48,
        duration: 0.25,
        velocity: 0.4,
      });
    }
  }

  // Timpani B — the higher drum answers with off-beat hits and a turnaround.
  if (layers.has("timpaniB")) {
    if (inBar === 0) {
      events.push({
        layer: "timpaniB",
        midi: score.timpaniHigh[bar] ?? 55,
        duration: 0.3,
        velocity: 0.55,
      });
    }
    if (inBar === 6 || inBar === 14) {
      events.push({
        layer: "timpaniB",
        midi: score.timpaniHigh[bar] ?? 55,
        duration: 0.2,
        velocity: 0.38,
      });
    }
  }

  return events;
}
