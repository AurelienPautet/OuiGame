import { Player } from "../Player.js";
import { makeFakeRoom } from "./fixtures/levels.js";

// Characterization tests for the Player class: construction defaults, spawn,
// aim-angle math (including the documented NaN/Infinity edge cases), movement +
// the hardcoded map-boundary clamps, shoot/plant ammo caps, and the collision
// helpers. Values are frozen from the live implementation.

const mkPlayer = (pos = { x: 200, y: 200 }) =>
  new Player(pos, "sock1", "Alice", "orange", "blue");

describe("Player construction defaults", () => {
  it("seeds the documented sizes/limits", () => {
    const p = mkPlayer();
    expect(p.size).toEqual({ w: 45, h: 45 });
    expect(p.max_bulletcount).toBe(5);
    expect(p.max_minecount).toBe(3);
    expect(p.mvtspeed).toBe(180); // px/second (3 px per 60 Hz step)
    expect(p.bulletcount).toBe(0);
    expect(p.minecount).toBe(0);
    expect(p.alive).toBe(true);
    expect(p.round_stats.stats.shots).toBe(0);
  });
});

describe("Player.spawn", () => {
  it("clones the spawn position and resets ammo + alive", () => {
    const p = mkPlayer();
    p.alive = false;
    p.bulletcount = 4;
    p.minecount = 2;
    const spawn = { x: 300, y: 400 };
    p.spawn(spawn);

    expect(p.position).toEqual({ x: 300, y: 400 });
    expect(p.position).not.toBe(spawn); // structuredClone, not aliased
    expect(p.spawnpos).toBe(spawn); // spawnpos keeps the original reference
    expect(p.alive).toBe(true);
    expect(p.bulletcount).toBe(0);
    expect(p.minecount).toBe(0);
  });
});

describe("Player.CalculateAngle", () => {
  // Player centre is (222.5, 222.5) for a player at (200,200).
  const aimAt = (x, y) => {
    const p = mkPlayer();
    p.aim = { x, y };
    p.CalculateAngle();
    return p.angle;
  };

  it("points toward an aim down-right (atan + PI)", () => {
    expect(aimAt(322.5, 322.5)).toBeCloseTo((5 * Math.PI) / 4, 12);
  });
  it("points toward an aim up-right", () => {
    expect(aimAt(322.5, 122.5)).toBeCloseTo((3 * Math.PI) / 4, 12);
  });
  it("points toward an aim down-left", () => {
    expect(aimAt(122.5, 322.5)).toBeCloseTo(-Math.PI / 4, 12);
  });
  it("points toward an aim up-left", () => {
    expect(aimAt(122.5, 122.5)).toBeCloseTo(Math.PI / 4, 12);
  });
  it("handles a straight-down aim (adjacent===0 -> +Infinity -> 3PI/2, not NaN)", () => {
    expect(aimAt(222.5, 1000)).toBeCloseTo((3 * Math.PI) / 2, 12);
  });
  it("yields NaN when aiming at its own centre (0/0)", () => {
    expect(Number.isNaN(aimAt(222.5, 222.5))).toBe(true);
  });
  it("yields NaN for a NaN aim (the try/catch fallback never fires)", () => {
    expect(Number.isNaN(aimAt(NaN, NaN))).toBe(true);
  });
});

describe("Player.endofbarrel", () => {
  it("projects the muzzle point from the player centre along the angle", () => {
    const p = mkPlayer();
    p.angle = 0;
    p.endofbarrel();
    // x = 200 + 22.5 - (30 + 15) * cos(0); y = 222.5 - 45*sin(0)
    expect(p.endpos.x).toBeCloseTo(177.5, 12);
    expect(p.endpos.y).toBeCloseTo(222.5, 12);
  });
});

describe("Player.shoot / plant — ammo caps + alive gating", () => {
  it("spawns a bullet while under the cap", () => {
    const p = mkPlayer();
    const room = makeFakeRoom();
    p.shoot(room);
    expect(room.bullets).toHaveLength(1);
    expect(p.bulletcount).toBe(1);
    expect(p.round_stats.stats.shots).toBe(1);
  });
  it("does not spawn a bullet at the cap", () => {
    const p = mkPlayer();
    p.bulletcount = 5;
    const room = makeFakeRoom();
    p.shoot(room);
    expect(room.bullets).toHaveLength(0);
  });
  it("does not spawn a bullet when dead", () => {
    const p = mkPlayer();
    p.alive = false;
    const room = makeFakeRoom();
    p.shoot(room);
    expect(room.bullets).toHaveLength(0);
  });
  it("plants a mine while under the cap", () => {
    const p = mkPlayer();
    const room = makeFakeRoom();
    p.plant(room);
    expect(room.mines).toHaveLength(1);
    expect(p.minecount).toBe(1);
    expect(p.round_stats.stats.plants).toBe(1);
  });
  it("does not plant at the cap or when dead", () => {
    const room = makeFakeRoom();
    const capped = mkPlayer();
    capped.minecount = 3;
    capped.plant(room);
    const dead = mkPlayer();
    dead.alive = false;
    dead.plant(room);
    expect(room.mines).toHaveLength(0);
  });
});

describe("Player.update — movement + boundary clamps", () => {
  const STEP = 1 / 60; // one fixed simulation step, in seconds

  it("moves at mvtspeed along a cardinal direction", () => {
    const p = mkPlayer();
    p.direction = { x: 1, y: 0 };
    p.update(makeFakeRoom(), STEP); // 180 px/s * (1/60) = 3 px
    expect(p.position.x).toBe(203);
    expect(p.position.y).toBe(200);
    expect(p.mytick).toBe(1);
  });

  it("normalises diagonal movement by 1/sqrt(2)", () => {
    const p = mkPlayer();
    p.direction = { x: 1, y: 1 };
    p.update(makeFakeRoom(), STEP);
    const step = 3 / Math.sqrt(2);
    expect(p.position.x).toBeCloseTo(200 + step, 12);
    expect(p.position.y).toBeCloseTo(200 + step, 12);
  });

  it("clamps to the left/top map edges (>= 50)", () => {
    const p = mkPlayer({ x: 51, y: 51 });
    p.direction = { x: -1, y: -1 };
    p.update(makeFakeRoom(), 5); // large step pushes well past the edge
    expect(p.position.x).toBe(50);
    expect(p.position.y).toBe(50);
  });

  it("clamps to the right/bottom map edges (x+45<=1100, y+45<=800)", () => {
    const p = mkPlayer({ x: 1050, y: 750 });
    p.direction = { x: 1, y: 1 };
    p.update(makeFakeRoom(), 5);
    expect(p.position.x).toBe(1055); // 50*22 - 45
    expect(p.position.y).toBe(755); // 50*16 - 45
  });

  it("does not move a dead player", () => {
    const p = mkPlayer();
    p.alive = false;
    p.velocity = { x: 5, y: 5 };
    p.direction = { x: 1, y: 1 };
    p.update(makeFakeRoom(), 1);
    expect(p.position).toEqual({ x: 200, y: 200 });
  });

  it("is a no-op when position is undefined", () => {
    const p = mkPlayer();
    p.position = undefined;
    expect(() => p.update(makeFakeRoom(), 1)).not.toThrow();
    expect(p.mytick).toBe(0);
  });
});

describe("Player.BodyCollision — zeroes velocity into the obstacle", () => {
  const block = { position: { x: 500, y: 500 }, size: { w: 50, h: 50 } };

  it("zeroes upward velocity on an up-side collision", () => {
    const p = mkPlayer({ x: 510, y: 540 });
    p.velocity = { x: 0, y: -3 };
    p.BodyCollision(block);
    expect(p.side).toBe("up");
    expect(p.velocity.y).toBe(0);
  });

  it("leaves downward velocity untouched on an up-side collision", () => {
    const p = mkPlayer({ x: 510, y: 540 });
    p.velocity = { x: 0, y: 3 };
    p.BodyCollision(block);
    expect(p.side).toBe("up");
    expect(p.velocity.y).toBe(3);
  });

  it("zeroes downward velocity on a down-side collision", () => {
    const p = mkPlayer({ x: 510, y: 470 });
    p.velocity = { x: 0, y: 3 };
    p.BodyCollision(block);
    expect(p.side).toBe("down");
    expect(p.velocity.y).toBe(0);
  });
});

describe("Player.BulletCollision", () => {
  it("reports an overlapping bullet and stores the side flag", () => {
    const p = mkPlayer({ x: 100, y: 100 });
    const bullet = { position: { x: 110, y: 110 }, size: { w: 15, h: 15 } };
    expect(p.BulletCollision(bullet)).toBe(true);
    expect(p.side).toBe(true);
  });
  it("reports no collision when far apart", () => {
    const p = mkPlayer({ x: 100, y: 100 });
    const bullet = { position: { x: 500, y: 500 }, size: { w: 15, h: 15 } };
    expect(p.BulletCollision(bullet)).toBe(false);
  });
  it("returns false when position is undefined", () => {
    const p = mkPlayer();
    p.position = undefined;
    expect(
      p.BulletCollision({ position: { x: 0, y: 0 }, size: { w: 1, h: 1 } })
    ).toBe(false);
  });
});
