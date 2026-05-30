// The collision math now ships in the built @ouigame/shared/game package; the
// api consumes its CommonJS build via require(), so this doubles as a smoke test
// that the dual ESM/CJS bundle is require-able from the api's jest env.
const {
  rectRect,
  detectCollision,
  colliderect,
  distance,
  rectanglesSeTouchent,
} = require("@ouigame/shared/game");

describe("rectRect (AABB overlap incl. touching edges)", () => {
  test("detects overlapping rectangles", () => {
    expect(rectRect(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
  });

  test("treats touching edges as a collision", () => {
    // r1 right edge (10) exactly meets r2 left edge (10)
    expect(rectRect(0, 0, 10, 10, 10, 0, 10, 10)).toBe(true);
  });

  test("returns false when far apart", () => {
    expect(rectRect(0, 0, 10, 10, 100, 100, 10, 10)).toBe(false);
  });
});

describe("distance (squared distance between rectangle centers)", () => {
  test("is zero for identical rectangles", () => {
    expect(
      distance(
        { x: 0, y: 0 },
        { w: 10, h: 10 },
        { x: 0, y: 0 },
        { w: 10, h: 10 }
      )
    ).toBe(0);
  });

  test("computes squared center distance horizontally", () => {
    expect(
      distance(
        { x: 0, y: 0 },
        { w: 10, h: 10 },
        { x: 10, y: 0 },
        { w: 10, h: 10 }
      )
    ).toBe(100);
  });
});

describe("rectanglesSeTouchent (strict AABB intersection)", () => {
  test("detects overlap", () => {
    expect(rectanglesSeTouchent(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
  });

  test("returns false when separated", () => {
    expect(rectanglesSeTouchent(0, 0, 10, 10, 20, 20, 5, 5)).toBe(false);
  });

  test("returns false when only edges touch (strict inequality)", () => {
    expect(rectanglesSeTouchent(0, 0, 10, 10, 10, 0, 10, 10)).toBe(false);
  });
});

describe("detectCollision", () => {
  const rect1 = { position: { x: 0, y: 0 }, size: { w: 10, h: 10 } };

  test("returns a valid side when moving into another rectangle", () => {
    const rect2 = { position: { x: 12, y: 0 }, size: { w: 10, h: 10 } };
    const side = detectCollision(rect1, rect2, { x: 5, y: 0 });
    expect(["left", "right", "up", "down"]).toContain(side);
  });

  test("returns empty string when no collision occurs", () => {
    const rect2 = { position: { x: 100, y: 100 }, size: { w: 10, h: 10 } };
    expect(detectCollision(rect1, rect2, { x: 5, y: 0 })).toBe("");
  });
});

describe("colliderect", () => {
  test("detects an upward collision", () => {
    // rect1 sits inside rect2's bounds; moving up by offset stays inside.
    expect(colliderect(50, 50, 10, 10, 0, 0, 100, 100, 10)).toBe("up");
  });

  test("returns empty string when rectangles are far apart", () => {
    expect(colliderect(1000, 1000, 10, 10, 0, 0, 10, 10, 1)).toBe("");
  });
});
