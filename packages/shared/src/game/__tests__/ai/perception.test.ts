import { Player } from "../../Player.js";
import { ThreatSummary, senseThreats } from "../../ai/perception.js";
import { ARCHETYPES } from "../../ai/archetypes.js";
import type { Room } from "../../Room.js";

// Pure threat-math tests on duck-typed rooms (the CPA/mine code only touches
// room.bullets / room.mines).

const AI = ARCHETYPES.bot3.ai; // dodgeSkill 0.95, horizon 0.9s

const mkBot = (cx: number, cy: number) => {
  const p = new Player({ x: cx - 22.5, y: cy - 22.5 }, "bot0", "B", "o", "o");
  return p;
};

const mkBullet = (
  cx: number,
  cy: number,
  vx: number,
  vy: number,
  emitter: Player | null = null
) => ({
  position: { x: cx - 7.5, y: cy - 7.5 },
  size: { w: 15, h: 15 },
  velocity: { x: vx, y: vy },
  bounce: 0,
  max_bounce: 3,
  emitter,
});

const roomWith = (bullets: unknown[], mines: unknown[] = []): Room =>
  ({ bullets, mines, players: {}, human_players: [] }) as unknown as Room;

describe("senseThreats — bullets (CPA)", () => {
  it("registers an incoming bullet and points the dodge away from its line", () => {
    const bot = mkBot(500, 400);
    const ts = new ThreatSummary();
    // Coming from the west, dead-on at 300 px/s, 150px out (0.5s to impact).
    const room = roomWith([mkBullet(350, 400, 300, 0)]);
    senseThreats(bot, room, ts, AI, 1, [], 0, false);

    expect(ts.urgency).toBeGreaterThan(0.2);
    expect(ts.imminentTCPA).toBeLessThan(0.6);
    // Head-on: dodge is perpendicular to the bullet's +x travel; with
    // headOnSign=1 the committed escape is south (+y).
    expect(Math.abs(ts.dodgeY)).toBeGreaterThan(Math.abs(ts.dodgeX));
    expect(ts.dodgeY).toBeGreaterThan(0);
    // Danger ordering: anti-escape (north) > along the bullet line (east) >
    // the committed escape (south, ~0).
    const east = ts.dirDanger[0]!;
    const north = ts.dirDanger[2]!;
    const south = ts.dirDanger[6]!;
    expect(north).toBeGreaterThan(east);
    expect(east).toBeGreaterThan(south);
  });

  it("ignores a bullet that will miss comfortably", () => {
    const bot = mkBot(500, 400);
    const ts = new ThreatSummary();
    // Parallel track 120px to the side.
    const room = roomWith([mkBullet(350, 280, 300, 0)]);
    senseThreats(bot, room, ts, AI, 1, [], 0, false);
    expect(ts.urgency).toBe(0);
  });

  it("ignores its own freshly fired (receding) bullet", () => {
    const bot = mkBot(500, 400);
    const ts = new ThreatSummary();
    // Muzzle distance, flying away east.
    const room = roomWith([mkBullet(545, 400, 300, 0, bot)]);
    senseThreats(bot, room, ts, AI, 1, [], 0, false);
    expect(ts.urgency).toBe(0);
  });

  it("dodges a returning ricochet via the bounce-threat window", () => {
    const bot = mkBot(500, 400);
    const ts = new ThreatSummary();
    // No real bullet on a collision course, but a stored post-bounce
    // continuation says one arrives in ~0.4s.
    const virt = {
      x: 380,
      y: 400,
      vx: 300,
      vy: 0,
      t0: 0.15,
      t1: 0.9,
    };
    senseThreats(bot, roomWith([]), ts, AI, 1, [virt], 0, false);
    expect(ts.urgency).toBeGreaterThan(0.1);
  });

  it("scales with dodgeSkill (a skill-0 archetype never reacts to bullets)", () => {
    const bot = mkBot(500, 400);
    const ts = new ThreatSummary();
    const room = roomWith([mkBullet(350, 400, 300, 0)]);
    senseThreats(bot, room, ts, ARCHETYPES.bot1.ai, 1, [], 0, false);
    expect(ts.urgency).toBe(0);
  });
});

describe("senseThreats — mines", () => {
  const mkMine = (
    cx: number,
    cy: number,
    timealive: number,
    emitter: Player | null = null
  ) => ({
    position: { x: cx, y: cy }, // Mine.position is the tank centre at plant
    radius: 15,
    timealive,
    emitter,
  });

  it("weights by fuse age: a fresh mine barely registers, an old one screams", () => {
    const bot = mkBot(500, 400);
    const fresh = new ThreatSummary();
    senseThreats(
      bot,
      roomWith([], [mkMine(470, 385, 10)]),
      fresh,
      AI,
      1,
      [],
      0,
      false
    );
    const old = new ThreatSummary();
    senseThreats(
      bot,
      roomWith([], [mkMine(470, 385, 290)]),
      old,
      AI,
      1,
      [],
      0,
      false
    );
    expect(old.mineUrgency).toBeGreaterThan(fresh.mineUrgency * 5);
    expect(old.mineUrgency).toBeGreaterThan(0.8);
    // The away vector points from the blast centre toward the bot (east-ish).
    expect(old.mineAwayX).toBeGreaterThan(0);
  });

  it("treats a mine about to be shot as fully armed", () => {
    const bot = mkBot(500, 400);
    const mine = mkMine(470, 385, 10); // young fuse
    // A bullet 60px from the mine, heading straight at it.
    const bullet = mkBullet(410, 385, 300, 0);
    const ts = new ThreatSummary();
    senseThreats(bot, roomWith([bullet], [mine]), ts, AI, 1, [], 0, false);
    expect(ts.mineUrgency).toBeGreaterThan(0.8);
  });

  it("mines threaten even zero-dodge archetypes (movers always avoid them)", () => {
    const bot = mkBot(500, 400);
    const ts = new ThreatSummary();
    senseThreats(
      bot,
      roomWith([], [mkMine(470, 385, 290)]),
      ts,
      ARCHETYPES.bot2.ai,
      1,
      [],
      0,
      false
    );
    expect(ts.mineUrgency).toBeGreaterThan(0.5);
  });
});
