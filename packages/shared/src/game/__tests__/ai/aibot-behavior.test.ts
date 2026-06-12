import { Room } from "../../Room.js";
import { Player } from "../../Player.js";
import { loadlevel, generateBcollision } from "../../level_loader.js";
import { SIM_STEP_S } from "../../loop.js";
import { AIBot } from "../../ai/index.js";
import {
  allKindsArena,
  duelArena,
  mazeArena,
  openArena,
} from "../fixtures/ai-levels.js";

// Capability characterization: seeded full-Room sims asserting the v2 bots
// actually DO the things the system was built for — lead moving targets,
// dodge aimed fire, path through mazes, and never blow themselves up. These
// are behavior gates for archetype tuning: tune archetypes.ts until they pass
// with margin; loosen an assertion only with a written justification.

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0); // spawn-slot determinism
});
afterEach(() => {
  vi.restoreAllMocks();
});

const MAP_W = 23 * 50;
const MAP_H = 16 * 50;

async function mkRoom(level: number[], seed: number): Promise<Room> {
  const room = new Room("arena", 1, [10], "creator", null);
  room.bot_system = "v2";
  room.bot_seed = seed;
  await loadlevel(level, room);
  room.spawn_new_player("Human", "orange", "blue", "h1");
  room.spawn_all_bots();
  return room;
}

const centerOf = (p: Player) => ({
  x: p.position.x + p.size.w / 2,
  y: p.position.y + p.size.h / 2,
});

describe("sanity invariants (all kinds, 1200 ticks)", () => {
  it("stays finite and in bounds; movers move, shooters shoot", async () => {
    const room = await mkRoom(allKindsArena, 99);
    const startPos = new Map<string, { x: number; y: number }>();
    const travelled = new Map<string, number>();
    const last = new Map<string, { x: number; y: number }>();
    for (const [id, p] of Object.entries(room.players)) {
      startPos.set(id, centerOf(p));
      last.set(id, centerOf(p));
      travelled.set(id, 0);
    }

    for (let t = 0; t < 1200; t++) {
      room.update(SIM_STEP_S);
      for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        const c = centerOf(p);
        expect(Number.isFinite(c.x)).toBe(true);
        expect(Number.isFinite(c.y)).toBe(true);
        expect(Number.isFinite(p.angle)).toBe(true);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThanOrEqual(MAP_W);
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(c.y).toBeLessThanOrEqual(MAP_H);
        const prev = last.get(id)!;
        travelled.set(
          id,
          travelled.get(id)! + Math.hypot(c.x - prev.x, c.y - prev.y)
        );
        last.set(id, c);
      }
    }

    // Stationary kinds never moved; mobile kinds covered real ground.
    const k = (id: string) => (room.players[id] as AIBot).kind;
    for (const id of ["bot0", "bot1", "bot2", "bot3"]) {
      const kind = k(id);
      const moved = travelled.get(id)!;
      if (kind === "bot1" || kind === "bot4") {
        expect(moved).toBeLessThan(2);
      } else {
        expect(moved).toBeGreaterThan(100);
      }
    }
    // Every kind took at least one shot in 20 s with a live target.
    for (const id of ["bot0", "bot1", "bot2", "bot3"]) {
      expect(room.players[id]!.round_stats.stats.shots).toBeGreaterThan(0);
    }
  });

  it("survives a mid-run wall breach (geometry + cached plans invalidated)", async () => {
    const room = await mkRoom(allKindsArena, 7);
    for (let t = 0; t < 300; t++) room.update(SIM_STEP_S);

    // Breach two interior border-adjacent cells exactly the way
    // Room.update_mines does it: blocklist → 10, splice block, regenerate.
    for (const target of [
      { row: 3, col: 5 },
      { row: 12, col: 5 },
    ]) {
      const idx = target.row * 23 + target.col;
      if (room.blocklist[idx] === 1 || room.blocklist[idx] === 2) {
        room.blocklist[idx] = 10;
      }
    }
    // Simulate a breach even if those cells were empty: punch out a border
    // wall segment the bots may have planned banks off.
    room.blocklist[8 * 23 + 22] = 10;
    room.blocks = room.blocks.filter(
      (b) => !(b.position.x === 22 * 50 && b.position.y === 8 * 50)
    );
    generateBcollision(room);

    expect(() => {
      for (let t = 0; t < 300; t++) room.update(SIM_STEP_S);
    }).not.toThrow();
    for (const p of Object.values(room.players)) {
      if (!p.alive) continue;
      const c = centerOf(p);
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
    }
  });
});

describe("capability: bot4 leads a patrolling target (TTK)", () => {
  it("median time-to-kill over 5 seeds is under 12 s", async () => {
    const ttks: number[] = [];
    for (const seed of [1, 2, 3, 4, 5]) {
      const room = await mkRoom(duelArena(14), seed);
      const human = room.players.h1!;
      let ttk = 1440;
      for (let t = 0; t < 1440; t++) {
        // Square patrol: full-speed direction cycling E,S,W,N every 90 ticks
        // (1.5 s legs — bullet flight here is ~1 s, so most shots land within
        // a leg; 45-tick legs would turn inside EVERY flight, which defeats
        // any finite-speed lead by construction).
        const phase = Math.floor(t / 90) % 4;
        human.direction.x = phase === 0 ? 1 : phase === 2 ? -1 : 0;
        human.direction.y = phase === 1 ? 1 : phase === 3 ? -1 : 0;
        room.update(SIM_STEP_S);
        if (!human.alive) {
          ttk = t;
          break;
        }
      }
      ttks.push(ttk);
    }
    ttks.sort((a, b) => a - b);
    expect(ttks[2]!).toBeLessThan(12 * 60);
  });
});

describe("capability: bot3 dodges aimed fire", () => {
  it("survives 20 s of aimbot shots in at least 4 of 5 seeds", async () => {
    let survived = 0;
    for (const seed of [11, 12, 13, 14, 15]) {
      const room = await mkRoom(duelArena(13), seed);
      const human = room.players.h1!;
      const bot = room.players.bot0!;
      let alive = true;
      for (let t = 0; t < 1200; t++) {
        // The bot's gun is pinned empty: this isolates DEFENSE (otherwise it
        // just kills the dummy and the test measures nothing).
        bot.bulletcount = bot.max_bulletcount;
        // Aimbot dummy: aims at the bot's current centre, fires every 40t.
        const c = centerOf(bot);
        human.aim = { x: c.x, y: c.y };
        if (t % 40 === 20 && human.alive) human.shoot(room);
        room.update(SIM_STEP_S);
        if (!bot.alive) {
          alive = false;
          break;
        }
      }
      if (alive) survived++;
    }
    expect(survived).toBeGreaterThanOrEqual(4);
  });
});

describe("capability: bot2 paths through a maze to its range band", () => {
  it("closes from ~1500px of corridor to within 400px in 20 s", async () => {
    const room = await mkRoom(mazeArena, 21);
    const human = room.players.h1!;
    const bot = room.players.bot0!;
    let best = Infinity;
    for (let t = 0; t < 1200 && human.alive && bot.alive; t++) {
      bot.bulletcount = bot.max_bulletcount; // navigation only
      room.update(SIM_STEP_S);
      const hc = centerOf(human);
      const bc = centerOf(bot);
      best = Math.min(best, Math.hypot(hc.x - bc.x, hc.y - bc.y));
    }
    expect(best).toBeLessThan(400);
  });
});

describe("capability: pursued bots flee-drop mines and survive them", () => {
  it("a chasing dummy provokes mines; the bot never dies to its own", async () => {
    const room = await mkRoom(openArena, 31);
    const human = room.players.h1!;
    const bot = room.players.bot0!; // bot2: fleeDrop 0.2
    let planted = 0;
    for (let t = 0; t < 1800 && human.alive; t++) {
      bot.bulletcount = bot.max_bulletcount; // the dummy must stay alive
      const bc = centerOf(bot);
      const hc = centerOf(human);
      human.direction.x = Math.sign(bc.x - hc.x);
      human.direction.y = Math.sign(bc.y - hc.y);
      room.update(SIM_STEP_S);
      planted = Math.max(planted, bot.round_stats.stats.plants);
      // The pursuer can run into a mine and die — that's the mine WORKING.
    }
    expect(planted).toBeGreaterThanOrEqual(1);
    expect(bot.alive).toBe(true); // never killed by its own mine
  });
});
