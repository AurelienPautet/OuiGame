const PlayerClass = require("../class/Player.js");
// Bot.js declares `class Bot extends Player`, reading `Player` as a global the
// way the browser <script> tags provide it. Set the global BEFORE requiring Bot
// (and never shadow it with a local `const Player`, which breaks resolution).
global.Player = PlayerClass;
const Bot = require("../class/Bot.js");

// Characterization (golden) tests for the bot AIM MATH. The plan freezes this
// math: any diff here is a regression, NEVER a re-baseline — the Phase 2
// keystone (de-globalizing the bots) must reproduce these outputs exactly. The
// expected values were captured from the live code. Vitest globals
// (describe/it/expect/vi/beforeEach/afterEach) are ambient (globals: true).
// Angle results that flow through Math.atan use toBeCloseTo so a last-ULP libm
// difference between Node versions can't cause a false failure; the pure
// PI-arithmetic results are pinned tightly.

const mkBot = () =>
  new Bot({ x: 200, y: 200 }, "bot1", "B", "orange", "orange");

beforeEach(() => {
  // The Bot constructor seeds mytick from Math.random and the idle-aim branch
  // jitters from it; pin it so every run is identical (the tests override the
  // fields they depend on, but this keeps any incidental use deterministic).
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.launch_possible_shots;
});

describe("Bot.angleDifference — signed shortest angle in [-PI, PI]", () => {
  it("is 0 when current === target", () => {
    expect(mkBot().angleDifference(0, 0)).toBe(0);
  });
  it("is -PI for a half turn (0 -> PI)", () => {
    expect(mkBot().angleDifference(0, Math.PI)).toBeCloseTo(-Math.PI, 12);
  });
  it("is +PI/2 for a quarter turn forward (0 -> PI/2)", () => {
    expect(mkBot().angleDifference(0, Math.PI / 2)).toBeCloseTo(
      Math.PI / 2,
      12
    );
  });
  it("is -PI/2 for a quarter turn backward (PI/2 -> 0)", () => {
    expect(mkBot().angleDifference(Math.PI / 2, 0)).toBeCloseTo(
      -Math.PI / 2,
      12
    );
  });
  it("wraps 1 -> 4 to 3", () => {
    expect(mkBot().angleDifference(1, 4)).toBeCloseTo(3, 12);
  });
  it("wraps 3 -> -3 to ~0.2832", () => {
    expect(mkBot().angleDifference(3, -3)).toBeCloseTo(0.28318530717958623, 12);
  });
});

describe("Bot.aim_to_angle — one rotation step (max_rotation_speed = PI/180)", () => {
  // The rotation DIRECTION is counterintuitive (target +1 from angle 0 steps to
  // -PI/180, not +PI/180). Frozen exactly as the live code produces.
  it("steps to -PI/180 toward target 1 from angle 0", () => {
    const b = mkBot();
    b.angle = 0;
    b.aim_to_angle(1);
    expect(b.angle).toBeCloseTo(-Math.PI / 180, 12);
  });
  it("snaps exactly to target when within one step", () => {
    const b = mkBot();
    b.angle = 0;
    b.aim_to_angle(0.01);
    expect(b.angle).toBe(0.01);
  });
  it("steps to 1 + PI/180 toward target 0 from angle 1", () => {
    const b = mkBot();
    b.angle = 1;
    b.aim_to_angle(0);
    expect(b.angle).toBeCloseTo(1 + Math.PI / 180, 12);
  });
  it("steps to +PI/180 toward target PI from angle 0", () => {
    const b = mkBot();
    b.angle = 0;
    b.aim_to_angle(Math.PI);
    expect(b.angle).toBeCloseTo(Math.PI / 180, 12);
  });
});

describe("Player.CalculateAngle — Math.atan barrel angle (+PI when aim is to the right)", () => {
  const calc = (aim) => {
    const p = new PlayerClass({ x: 200, y: 200 }, "p", "P", "o", "o");
    p.aim = aim;
    p.CalculateAngle();
    return p.angle;
  };
  it("aim to the right", () => {
    expect(calc({ x: 300, y: 200 })).toBeCloseTo(2.8590377011202057, 10);
  });
  it("aim to the left", () => {
    expect(calc({ x: 100, y: 200 })).toBeCloseTo(0.18164883000001195, 10);
  });
  it("aim straight down", () => {
    expect(calc({ x: 200, y: 300 })).toBeCloseTo(-1.2882413743253092, 10);
  });
  it("aim down-right diagonal", () => {
    expect(calc({ x: 260, y: 260 })).toBeCloseTo(3.9269908169872414, 10);
  });
});

describe("Bot killing_aims sort — (a,b) => a.distance - b.distance + 0.1*(a.angle - b.angle)", () => {
  it("orders by distance, with the 0.1*angle term ordering equal distances", () => {
    const b = mkBot();
    b.mytick = 0; // mytick % 5 === 0 triggers the sort path
    b.last_shoot.mytick = 0; // keeps the shoot-interval gate closed (no shoot)
    b.can.spam = true;
    const entries = [
      { angle: 1.0, distance: 5 },
      { angle: 0.5, distance: 3 },
      { angle: 2.0, distance: 3 },
      { angle: 0.2, distance: 8 },
    ];
    global.launch_possible_shots = (n, s, r, bot) => {
      for (const e of entries) bot.killing_aims.push({ ...e });
    };
    b.aim_and_shoot();
    expect(b.killing_aims).toEqual([
      { angle: 0.5, distance: 3 },
      { angle: 2.0, distance: 3 },
      { angle: 1.0, distance: 5 },
      { angle: 0.2, distance: 8 },
    ]);
  });
});

describe("Bot shoot gate — fires only when |angleDifference(angle, desired)| is in PI +/- precision", () => {
  // precision = 0.7; the gate is centred on PI (a half-turn), NOT 0 — the bot
  // shoots when its angle is ~opposite the desired angle. Frozen as-is.
  const runGate = (angleOffset) => {
    const b = mkBot();
    b.mytick = 200;
    b.last_shoot.mytick = 15; // 200 - 15 = 185 > min_interval_shoot (140): gate open
    b.can.spam = true;
    const targetAngle = 1.0;
    b.angle = targetAngle + angleOffset;
    let fired = false;
    b.shoot = () => {
      fired = true;
    };
    global.launch_possible_shots = (n, s, r, bot) => {
      bot.killing_aims.push({ angle: targetAngle, distance: 1 });
    };
    b.aim_and_shoot();
    return fired;
  };
  it("does NOT shoot when aligned with the desired angle (|diff| ~ 0)", () => {
    expect(runGate(0)).toBe(false);
  });
  it("shoots when ~opposite the desired angle (|diff| ~ PI)", () => {
    expect(runGate(Math.PI)).toBe(true);
  });
});
