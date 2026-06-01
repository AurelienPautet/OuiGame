import { Bullet } from "../Bullet.js";
import { Stats } from "../Stats.js";

// Characterization tests for bullet physics: construction side-effects and the
// wall-reflection / anti-stick logic in collision_walls. Reflection geometry is
// captured from the live detectCollision math — any diff is a regression.

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

describe("Bullet.collision_walls — reflection + bounce accounting", () => {
  // Helper: a fresh bullet positioned at (100,100) with controllable velocity.
  const freshBullet = (room) => {
    const b = new Bullet(
      { x: 107.5, y: 107.5 },
      0,
      5,
      { w: 15, h: 15 },
      3,
      1,
      makeEmitter(),
      room
    );
    // position becomes (100,100) after the -size/2 offset.
    expect(b.position).toEqual({ x: 100, y: 100 });
    return b;
  };

  it("reflects on the X axis for a right-side hit and counts the bounce", () => {
    const room = makeRoom();
    const b = freshBullet(room);
    room.emitted.length = 0; // drop the construction shoot_explosion
    const obj = { position: { x: 108, y: 100 }, size: { w: 50, h: 50 } };

    b.collision_walls(obj, room);

    expect(b.side).toBe("right");
    expect(b.velocity.x).toBe(5); // -(-5)
    expect(b.angle).toBeCloseTo(Math.PI, 12); // PI - 0
    expect(b.bounce).toBe(1);
    expect(b.last_collision_object).toBe(obj);
    expect(room.sounds.ricochet).toBe(true);
    expect(room.emitted.map((e) => e.event)).toEqual(["ricochet_explosion"]);
  });

  it("reflects on the X axis for a left-side hit", () => {
    const room = makeRoom();
    const b = freshBullet(room);
    const obj = { position: { x: 60, y: 100 }, size: { w: 50, h: 50 } };
    b.collision_walls(obj, room);
    expect(b.side).toBe("left");
    expect(b.velocity.x).toBe(5);
  });

  it("reflects on the Y axis for an up-side hit", () => {
    const room = makeRoom();
    const b = freshBullet(room);
    b.velocity.y = 4;
    const obj = { position: { x: 100, y: 60 }, size: { w: 50, h: 50 } };
    b.collision_walls(obj, room);
    expect(b.side).toBe("up");
    expect(b.velocity.y).toBe(-4);
  });

  it("reflects on the Y axis for a down-side hit", () => {
    const room = makeRoom();
    const b = freshBullet(room);
    b.velocity.y = 4;
    const obj = { position: { x: 100, y: 108 }, size: { w: 50, h: 50 } };
    b.collision_walls(obj, room);
    expect(b.side).toBe("down");
    expect(b.velocity.y).toBe(-4);
  });

  it("ignores a second hit against the same object (anti-stick guard)", () => {
    const room = makeRoom();
    const b = freshBullet(room);
    const obj = { position: { x: 108, y: 100 }, size: { w: 50, h: 50 } };
    b.collision_walls(obj, room);
    const bounceAfterFirst = b.bounce;
    const velAfterFirst = b.velocity.x;
    b.collision_walls(obj, room); // same obj -> early return
    expect(b.bounce).toBe(bounceAfterFirst);
    expect(b.velocity.x).toBe(velAfterFirst);
  });

  it("stops emitting ricochet sparks once bounce reaches max_bounce", () => {
    const room = makeRoom();
    const b = freshBullet(room);
    b.bounce = 3; // already at max
    room.emitted.length = 0;
    const obj = { position: { x: 108, y: 100 }, size: { w: 50, h: 50 } };
    b.collision_walls(obj, room);
    expect(b.bounce).toBe(4); // still counts
    expect(b.velocity.x).toBe(5); // still reflects
    expect(room.emitted).toEqual([]); // but no ricochet_explosion
  });
});
