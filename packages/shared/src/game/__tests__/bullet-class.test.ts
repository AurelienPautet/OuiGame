import { Bullet } from "../Bullet.js";
import { Stats } from "../Stats.js";

// Tests for bullet physics: construction side-effects and the continuous
// (swept) wall-collision in update(), which reflects off walls and guarantees a
// bullet can never tunnel through geometry in a single step, whatever its speed.

const makeEmitter = () => ({
  bulletcount: 0,
  round_stats: new Stats(),
  endpos: { x: 11, y: 22 },
  angle: 0.5,
});

// Records emit_to_room calls so we can assert the ricochet/shoot events.
const makeRoom = () => {
  const emitted = [];
  return {
    sounds: {},
    bullets: [],
    Bcollision: [],
    emit_to_room: (event, data) => emitted.push({ event, data }),
    emitted,
  };
};

describe("Bullet construction", () => {
  it("derives velocity/position and registers with emitter + room", () => {
    const emitter = makeEmitter();
    const room = makeRoom();
    const b = new Bullet(
      { x: 100, y: 100 },
      0,
      5,
      { w: 15, h: 15 },
      3,
      1,
      emitter,
      room
    );

    expect(b.velocity.x).toBe(-5); // -cos(0) * 5
    expect(b.velocity.y).toBeCloseTo(0, 12); // -sin(0) * 5
    expect(b.position).toEqual({ x: 92.5, y: 92.5 }); // offset by -size/2
    expect(b.draw_size).toEqual({ w: 22.5, h: 15 });
    expect(b.bounce).toBe(0);
    expect(b.max_bounce).toBe(3);
    expect(b.last_collision_object).toBeNull();

    expect(emitter.bulletcount).toBe(1);
    expect(emitter.round_stats.stats.shots).toBe(1);
    expect(room.sounds.shoot).toBe(true);
    expect(room.bullets).toEqual([b]);
    expect(room.emitted).toEqual([
      {
        event: "shoot_explosion",
        data: { position: { x: 11, y: 22 }, angle: 0.5 },
      },
    ]);
  });
});

describe("Bullet.update — continuous (swept) wall collision", () => {
  const wall = (x, y, w, h) => ({ position: { x, y }, size: { w, h } });

  // A bullet centred at (100,100) (size 10 → position 95,95) with a velocity we
  // control directly (px/second); update() is stepped with dt = 1 so the
  // displacement equals the velocity, making the geometry easy to reason about.
  const makeBullet = (room, vx, vy) => {
    const b = new Bullet(
      { x: 100, y: 100 },
      0,
      0,
      { w: 10, h: 10 },
      3,
      1,
      makeEmitter(),
      room
    );
    b.velocity.x = vx;
    b.velocity.y = vy;
    return b;
  };

  it("reflects on the X axis instead of crossing a wall to the right", () => {
    const room = makeRoom();
    room.Bcollision = [wall(140, 80, 50, 50)];
    const b = makeBullet(room, 100, 0); // would travel +100px through the wall
    room.emitted.length = 0; // drop the construction shoot_explosion

    b.update(room, 1);

    expect(b.velocity.x).toBeLessThan(0); // bounced back
    expect(b.bounce).toBe(1);
    // never tunneled: the centre stays on the near side of the wall's left face
    expect(b.position.x + b.size.w / 2).toBeLessThanOrEqual(140);
    expect(room.sounds.ricochet).toBe(true);
    expect(room.emitted.map((e) => e.event)).toContain("ricochet_explosion");
  });

  it("reflects on the Y axis instead of crossing a wall below", () => {
    const room = makeRoom();
    room.Bcollision = [wall(80, 140, 50, 50)];
    const b = makeBullet(room, 0, 100);

    b.update(room, 1);

    expect(b.velocity.y).toBeLessThan(0);
    expect(b.position.y + b.size.h / 2).toBeLessThanOrEqual(140);
  });

  it("does not tunnel through a thin wall even at very high speed", () => {
    const room = makeRoom();
    room.Bcollision = [wall(200, 0, 20, 300)]; // thin vertical wall
    const b = makeBullet(room, 5000, 0); // far overshoots the wall in one step

    b.update(room, 1);

    expect(b.velocity.x).toBeLessThan(0); // reflected, did not pass through
    expect(b.bounce).toBeGreaterThanOrEqual(1);
    expect(b.position.x + b.size.w / 2).toBeLessThanOrEqual(200);
  });

  it("stops emitting ricochet sparks once bounce reaches max_bounce", () => {
    const room = makeRoom();
    room.Bcollision = [wall(140, 80, 50, 50)];
    const b = makeBullet(room, 100, 0);
    b.bounce = 3; // already at max
    room.emitted.length = 0;

    b.update(room, 1);

    expect(b.bounce).toBe(4); // still counts
    expect(b.velocity.x).toBeLessThan(0); // still reflects
    expect(room.emitted).toEqual([]); // but no ricochet_explosion
  });
});
