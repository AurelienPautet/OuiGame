import { describe, expect, it } from "vitest";
import {
  BARS,
  MENU_LAYERS,
  STEPS_PER_BAR,
  TOTAL_STEPS,
  bassNote,
  buildScore,
  chordVoicing,
  eventsForStep,
  layersForTanks,
  midiToFreq,
  tankKindFrom,
  type LayerName,
} from "../score";

describe("score generation", () => {
  it("builds an eight-bar score with one chord per bar", () => {
    const score = buildScore("menu", 1);
    expect(score.chords).toHaveLength(BARS);
    expect(score.chordTones).toHaveLength(BARS);
    expect(score.melody).toHaveLength(BARS * 8);
    expect(score.bass).toHaveLength(BARS);
    expect(score.totalSteps).toBe(TOTAL_STEPS);
  });

  it("is deterministic for a given seed and varies with another seed", () => {
    expect(buildScore("game", 42)).toEqual(buildScore("game", 42));
    expect(buildScore("game", 42).melody).not.toEqual(
      buildScore("game", 43).melody
    );
  });

  it("uses different progressions for menu and game", () => {
    expect(buildScore("menu", 1).chords.slice(0, 4)).toEqual([
      "C",
      "Am",
      "F",
      "G",
    ]);
    expect(buildScore("game", 1).chords.slice(0, 4)).toEqual([
      "C",
      "G",
      "Am",
      "F",
    ]);
  });

  it("keeps melody notes inside the C4–A5 register", () => {
    for (const mode of ["menu", "game"] as const) {
      for (const note of buildScore(mode, 7).melody) {
        if (note == null) continue;
        expect(note).toBeGreaterThanOrEqual(60);
        expect(note).toBeLessThanOrEqual(81);
      }
    }
  });

  it("puts chord tones on strong beats", () => {
    const score = buildScore("game", 9);
    for (let bar = 0; bar < BARS; bar++) {
      const chord = new Set(score.chordTones[bar]!.map((n) => n % 12));
      for (const slot of [0, 4]) {
        const note = score.melody[bar * 8 + slot];
        if (note == null) continue;
        expect(chord.has(note % 12)).toBe(true);
      }
    }
  });

  it("builds bass roots in the C2–A1 pocket", () => {
    expect(bassNote(48)).toBe(36); // C2
    expect(bassNote(57)).toBe(33); // A1, not A2
    expect(bassNote(55)).toBe(43); // G2
  });

  it("voices chords as ascending triads", () => {
    expect(chordVoicing("C")).toEqual([48, 52, 55]);
    expect(chordVoicing("Am")).toEqual([57, 60, 64]);
  });

  it("converts MIDI to frequency with A4 = 440 Hz", () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1);
  });
});

describe("tank-driven arrangement (Wii Tanks chart)", () => {
  const sorted = (layers: readonly LayerName[]) => [...layers].sort();

  it("leaves only the flute/basic track on an empty field", () => {
    expect(layersForTanks([])).toEqual(["melody"]);
  });

  it("brown is the lowest priority and never brings a timpani", () => {
    expect(sorted(layersForTanks(["brown"]))).toEqual(["melody", "snare"]);
    expect(sorted(layersForTanks(["brown", "brown", "brown"]))).toEqual([
      "melody",
      "snare",
    ]);
  });

  it("adds metronome to grey and a timpani only from three tanks", () => {
    expect(sorted(layersForTanks(["grey"]))).toEqual([
      "melody",
      "metronome",
      "snare",
    ]);
    expect(sorted(layersForTanks(["grey", "grey"]))).toEqual([
      "melody",
      "metronome",
      "snare",
    ]);
    expect(sorted(layersForTanks(["grey", "grey", "grey"]))).toEqual([
      "melody",
      "metronome",
      "snare",
      "timpaniA",
    ]);
  });

  it("teal drops the snare when it is alone and swaps to timpani B at four", () => {
    expect(sorted(layersForTanks(["teal"]))).toEqual([
      "cymbal",
      "melody",
      "metronome",
      "timpaniA",
    ]);
    expect(sorted(layersForTanks(["teal", "teal"]))).toEqual([
      "cymbal",
      "melody",
      "metronome",
      "snare",
      "timpaniA",
    ]);
    expect(sorted(layersForTanks(["teal", "teal", "teal"]))).toEqual([
      "cymbal",
      "melody",
      "metronome",
      "snare",
      "timpaniA",
    ]);
    expect(sorted(layersForTanks(["teal", "teal", "teal", "teal"]))).toEqual([
      "cymbal",
      "melody",
      "metronome",
      "snare",
      "timpaniB",
    ]);
  });

  it("pink (red) gains cymbals at two and the metronome at three", () => {
    expect(sorted(layersForTanks(["magenta"]))).toEqual([
      "melody",
      "snare",
      "timpaniB",
    ]);
    expect(sorted(layersForTanks(["magenta", "magenta"]))).toEqual([
      "cymbal",
      "melody",
      "snare",
      "timpaniB",
    ]);
    expect(sorted(layersForTanks(["magenta", "magenta", "magenta"]))).toEqual([
      "cymbal",
      "melody",
      "metronome",
      "snare",
      "timpaniB",
    ]);
  });

  it("purple alone has no snare and no bass drum", () => {
    expect(sorted(layersForTanks(["purple"]))).toEqual([
      "bass",
      "cymbal",
      "melody",
      "timpaniA",
    ]);
    expect(sorted(layersForTanks(["purple", "purple"]))).toEqual([
      "bass",
      "cymbal",
      "kick",
      "melody",
      "snare",
      "timpaniA",
    ]);
  });

  it("green grows in four steps and keeps the bells", () => {
    expect(sorted(layersForTanks(["green"]))).toEqual([
      "bass",
      "bells",
      "cymbal",
      "melody",
      "timpaniA",
    ]);
    expect(sorted(layersForTanks(["green", "green"]))).toContain("kick");
    const three = sorted(layersForTanks(["green", "green", "green"]));
    expect(three).toContain("timpaniA");
    expect(three).toContain("bells");
    const four = sorted(layersForTanks(["green", "green", "green", "green"]));
    expect(four).toContain("timpaniB");
    expect(four).not.toContain("timpaniA");
  });

  it("white alone has synth but no bass drum; three brings cymbals", () => {
    const one = sorted(layersForTanks(["white"]));
    expect(one).toContain("synth");
    expect(one).not.toContain("kick");
    const two = sorted(layersForTanks(["white", "white"]));
    expect(two).toContain("kick");
    expect(two).not.toContain("cymbal");
    const three = sorted(layersForTanks(["white", "white", "white"]));
    expect(three).toContain("cymbal");
  });

  it("black alone is the busiest row and has no snare", () => {
    const black = sorted(layersForTanks(["black"]));
    expect(black).toEqual([
      "bass",
      "bells",
      "cymbal",
      "kick",
      "melody",
      "metronome",
      "synth",
      "timpaniB",
    ]);
    expect(black).not.toContain("snare");
  });

  it("lets the strongest tank replace every weaker one", () => {
    // A lone brown tank would leave only flute + snare, but the white tank in
    // the same fight outranks it (three survivors → white's three-tank tier).
    expect(layersForTanks(["brown", "white", "brown"])).toEqual(
      layersForTanks(["white", "white", "white"])
    );
    expect(layersForTanks(["green", "black", "yellow"])).toEqual(
      layersForTanks(["black"])
    );
  });

  it("is order-independent", () => {
    const a = layersForTanks(["green", "brown", "white", "brown"]);
    const b = layersForTanks(["brown", "white", "brown", "green"]);
    expect(sorted(a)).toEqual(sorted(b));
  });

  it("maps the game's colour and bot-id vocabulary onto the chart", () => {
    expect(tankKindFrom("grey")).toBe("grey");
    expect(tankKindFrom("dimgray")).toBe("grey");
    expect(tankKindFrom("turquoise")).toBe("teal");
    expect(tankKindFrom("magenta")).toBe("pink");
    expect(tankKindFrom("red")).toBe("pink");
    expect(tankKindFrom("violet")).toBe("purple");
    expect(tankKindFrom("bot9")).toBe("black");
    expect(tankKindFrom("blue")).toBe("match");
    expect(tankKindFrom("orange")).toBe("match");
    expect(tankKindFrom(undefined)).toBe("match");
  });

  it("grows a plain groove for an all-human FFA (no Wii tank kinds)", () => {
    const one = layersForTanks(["orange"]);
    const two = layersForTanks(["orange", "blue"]);
    const four = layersForTanks(["orange", "blue", "blue", "orange"]);
    expect(two.length).toBeGreaterThan(one.length);
    expect(four.length).toBeGreaterThan(two.length);
    // The named Wii rows still take over when a real enemy tank is present.
    expect(layersForTanks(["orange", "green"])).toEqual(
      layersForTanks(["green", "green"])
    );
  });
});

describe("stem patterns", () => {
  const set = (...layers: LayerName[]): Set<LayerName> => new Set(layers);

  const count = (layers: Set<LayerName>) => {
    const score = buildScore("game", 3);
    const counts: Partial<Record<LayerName, number>> = {};
    for (let step = 0; step < TOTAL_STEPS; step++) {
      for (const event of eventsForStep(score, step, layers)) {
        counts[event.layer] = (counts[event.layer] ?? 0) + 1;
      }
    }
    return counts;
  };

  it("plays only the stems in the active arrangement", () => {
    const counts = count(set("melody"));
    expect(Object.keys(counts)).toEqual(["melody"]);
    expect(counts.melody).toBeGreaterThan(0);
  });

  it("gives every chart stem its own pattern", () => {
    const all = count(set(...layersForTanks(["black"])));
    for (const layer of layersForTanks(["black"])) {
      expect(all[layer]).toBeGreaterThan(0);
    }
    expect(all.snare).toBeUndefined();
  });

  it("keeps a brown fight to flute and snare", () => {
    const counts = count(new Set(layersForTanks(["brown", "brown"])));
    expect(Object.keys(counts).sort()).toEqual(["melody", "snare"]);
  });

  it("puts the high timpani above the low one", () => {
    const score = buildScore("game", 11);
    const pitch = (layer: "timpaniA" | "timpaniB") => {
      for (let step = 0; step < STEPS_PER_BAR; step++) {
        for (const event of eventsForStep(score, step, set(layer))) {
          if (event.layer === layer) return event.midi;
        }
      }
      return NaN;
    };
    expect(pitch("timpaniB")).toBeGreaterThan(pitch("timpaniA"));
  });

  it("keeps the menu free of game percussion", () => {
    const counts = count(new Set(MENU_LAYERS));
    expect(counts.kick).toBeUndefined();
    expect(counts.snare).toBeUndefined();
    expect(counts.cymbal).toBeUndefined();
    expect(counts.timpaniA).toBeUndefined();
    expect(counts.melody).toBeGreaterThan(0);
  });

  it("keeps every velocity inside 0..1", () => {
    const score = buildScore("game", 5);
    const all = set(...layersForTanks(["black"]));
    for (let step = 0; step < TOTAL_STEPS; step++) {
      for (const event of eventsForStep(score, step, all)) {
        expect(event.velocity).toBeGreaterThan(0);
        expect(event.velocity).toBeLessThanOrEqual(1);
      }
    }
  });
});
