const PlayerClass = require("../class/Player.js");
global.Player = PlayerClass;
const BotClass = require("../class/Bot.js");
global.Bot = BotClass;
// Characterization (golden) test pinning the per-kind bot INSTANCE SHAPE. The
// Bot1-4 subclasses were collapsed into a single config-driven Bot +
// BOT_CONFIGS (Phase 2 PR-C); this pins that `new Bot(..., kind)` reproduces
// each former subclass field-for-field. Any diff is a regression.
//
// It also pins the mytick RNG-seeding invariant: the Bot constructor sets
// min_interval_shoot=140 and seeds mytick=floor(random*140) BEFORE applying the
// per-kind config — so mytick is in [0,139] for ALL kinds. That is a parity
// trap the aim-math golden tests (which mock Math.random=0) do not cover: a
// config-driven Bot that applied config before seeding mytick would silently
// change this. Vitest globals are ambient (shared project `globals: true`).

const KINDS = [
  {
    kind: "bot1",
    name: "Bot1",
    min_interval_shoot: 170,
    max_rotation_speed: Math.PI / 200,
    max_bulletcount: 3,
    shoot_speed: 5,
    precision: 0.4,
    number_of_rays: 50,
    size_of_rays: 10,
    steps_of_rays: 10,
    shoot_max_bounce: 3,
    bullet_type: 1,
    bullet_size: { w: 15, h: 15 },
    can: { move: false, shoot: true, plant: true, spam: true },
  },
  {
    kind: "bot2",
    name: "Bot2",
    min_interval_shoot: 60,
    max_rotation_speed: Math.PI / 100,
    max_bulletcount: 3,
    shoot_speed: 5,
    precision: 0.1,
    number_of_rays: 50,
    size_of_rays: 10,
    steps_of_rays: 10,
    shoot_max_bounce: 3,
    bullet_type: 1,
    bullet_size: { w: 15, h: 15 },
    can: { move: true, shoot: true, plant: true, spam: true },
  },
  {
    kind: "bot3",
    name: "Bot3",
    min_interval_shoot: 90,
    max_rotation_speed: Math.PI / 100,
    max_bulletcount: 3,
    shoot_speed: 10,
    precision: 0.01,
    number_of_rays: 50,
    size_of_rays: 10,
    steps_of_rays: 10,
    shoot_max_bounce: 1,
    bullet_type: 2,
    bullet_size: { w: 15, h: 15 },
    can: { move: true, shoot: true, plant: true, spam: true },
  },
  {
    kind: "bot4",
    name: "Bot4",
    min_interval_shoot: 90,
    max_rotation_speed: Math.PI / 80,
    max_bulletcount: 3,
    shoot_speed: 10,
    precision: 0.01,
    number_of_rays: 50,
    size_of_rays: 5,
    steps_of_rays: 5,
    shoot_max_bounce: 3,
    bullet_type: 2,
    bullet_size: { w: 20, h: 20 },
    can: { move: false, shoot: true, plant: true, spam: true },
  },
];

const make = (kind) =>
  new BotClass({ x: 100, y: 100 }, "bot0", "B", "blue", "orange", kind);

describe("Bot1-4 instance shape (pinned before the config-driven collapse)", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const k of KINDS) {
    it(`${k.name} has the expected config fields`, () => {
      const b = make(k.kind);
      expect(b.min_interval_shoot).toBe(k.min_interval_shoot);
      expect(b.max_rotation_speed).toBe(k.max_rotation_speed);
      expect(b.max_bulletcount).toBe(k.max_bulletcount);
      expect(b.shoot_speed).toBe(k.shoot_speed);
      expect(b.precision).toBe(k.precision);
      expect(b.number_of_rays).toBe(k.number_of_rays);
      expect(b.size_of_rays).toBe(k.size_of_rays);
      expect(b.steps_of_rays).toBe(k.steps_of_rays);
      expect(b.shoot_max_bounce).toBe(k.shoot_max_bounce);
      expect(b.bullet_type).toBe(k.bullet_type);
      expect(b.bullet_size).toEqual(k.bullet_size);
      expect(b.can).toEqual(k.can);
      // turret/body colours come from the constructor args, not the kind.
      expect(b.turretc).toBe("blue");
      expect(b.bodyc).toBe("orange");
    });
  }
});

describe("Bot mytick is seeded from the base min_interval_shoot (140)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  for (const k of KINDS) {
    it(`${k.name} seeds mytick from 140 regardless of its own interval`, () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const b = make(k.kind);
      // floor(0.99 * 140) = 138 for every kind. If a kind seeded mytick from
      // its OWN min_interval_shoot (e.g. Bot1=170 -> 168) this would differ.
      expect(b.mytick).toBe(138);
    });
  }
});
