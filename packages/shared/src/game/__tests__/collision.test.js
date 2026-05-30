import {
  rectRect,
  rectanglesSeTouchent,
  colliderect,
  distance,
  detectCollision,
} from "../check_collision.js";
import { rectRect2 } from "../possible_shots_balls.js";
import { intersectRaySegment, getEdges } from "../check_intersect.js";

// Characterization (golden) tests for the shared collision math. They freeze
// the behaviour so the Phase 2 keystone (the ESM conversion + bot
// de-globalization that moved this code into @ouigame/shared/game) cannot
// silently change it: any diff here is a regression, never a re-baseline. The
// expected values were captured from the live code. Vitest globals
// (describe/it/expect) are ambient via the `shared` project's `globals: true`.

describe("rectRect / rectRect2 — inclusive edges (>=, <=)", () => {
  it("reports overlapping rects", () => {
    expect(rectRect(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
  });

  it("reports a gap as no collision", () => {
    expect(rectRect(0, 0, 10, 10, 20, 0, 10, 10)).toBe(false);
  });

  it("treats an exact edge touch as a collision", () => {
    expect(rectRect(0, 0, 10, 10, 10, 0, 10, 10)).toBe(true); // right meets left
    expect(rectRect(0, 0, 10, 10, 0, 10, 10, 10)).toBe(true); // bottom meets top
    expect(rectRect(0, 0, 10, 10, 10, 10, 10, 10)).toBe(true); // corner touch
  });

  it("rectRect2 is byte-for-byte equivalent to rectRect across a grid", () => {
    // The plan keeps these two functions separate until a test proves them
    // equivalent — this is that proof. If they ever diverge, this fails and a
    // future merge is unsafe.
    for (let dx = -12; dx <= 12; dx += 3) {
      for (let dy = -12; dy <= 12; dy += 3) {
        expect(rectRect2(0, 0, 10, 10, dx, dy, 10, 10)).toBe(
          rectRect(0, 0, 10, 10, dx, dy, 10, 10)
        );
      }
    }
  });
});

describe("rectanglesSeTouchent — strict edges (<, >)", () => {
  it("reports overlapping rects", () => {
    expect(rectanglesSeTouchent(0, 0, 10, 10, 5, 5, 10, 10)).toBe(true);
  });

  it("treats an exact edge touch as NO collision (the load-bearing difference vs rectRect)", () => {
    expect(rectanglesSeTouchent(0, 0, 10, 10, 10, 0, 10, 10)).toBe(false);
    // Same inputs, opposite answer from rectRect at an exact edge touch:
    expect(rectRect(0, 0, 10, 10, 10, 0, 10, 10)).toBe(true);
  });
});

describe("colliderect (body collision, offset 3)", () => {
  // Args: (rect1t, rect1l, rect1w, rect1h, rect2t, rect2l, rect2w, rect2h, off)
  // where t = top (y) and l = left (x). The returned side names are
  // counterintuitive (rect1 ABOVE rect2 returns "down", etc.) — these are the
  // current outputs and are frozen exactly as-is.
  it("rect1 above rect2 -> 'down'", () => {
    expect(colliderect(53, 100, 45, 45, 100, 100, 50, 50, 3)).toBe("down");
  });
  it("rect1 below rect2 -> 'up'", () => {
    expect(colliderect(150, 100, 45, 45, 100, 100, 50, 50, 3)).toBe("up");
  });
  it("rect1 left of rect2 -> 'right'", () => {
    expect(colliderect(100, 53, 45, 45, 100, 100, 50, 50, 3)).toBe("right");
  });
  it("rect1 right of rect2 -> 'left'", () => {
    expect(colliderect(100, 150, 45, 45, 100, 100, 50, 50, 3)).toBe("left");
  });
  it("no overlap -> ''", () => {
    expect(colliderect(0, 0, 45, 45, 500, 500, 50, 50, 3)).toBe("");
  });
});

describe("detectCollision (smallest-overlap side)", () => {
  it("returns the collision side for an overlapping sweep", () => {
    const r1 = { position: { x: 90, y: 100 }, size: { w: 45, h: 45 } };
    const r2 = { position: { x: 120, y: 100 }, size: { w: 50, h: 50 } };
    expect(detectCollision(r1, r2, { x: 5, y: 0 })).toBe("right");
  });
  it("returns '' when far apart", () => {
    const r1 = { position: { x: 0, y: 0 }, size: { w: 10, h: 10 } };
    const r2 = { position: { x: 500, y: 500 }, size: { w: 10, h: 10 } };
    expect(detectCollision(r1, r2, { x: 0, y: 0 })).toBe("");
  });
});

describe("distance (squared, center-to-center)", () => {
  it("returns the squared distance between rect centers", () => {
    // centers offset by (30, 40) -> 30^2 + 40^2 = 2500
    expect(
      distance(
        { x: 0, y: 0 },
        { w: 10, h: 10 },
        { x: 30, y: 40 },
        { w: 10, h: 10 }
      )
    ).toBe(2500);
  });
});

describe("intersectRaySegment", () => {
  it("returns the hit point and distance along the ray", () => {
    expect(
      intersectRaySegment(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 5, y: -5 },
        { x: 5, y: 5 }
      )
    ).toEqual({ x: 5, y: 0, dist: 5 });
  });
  it("returns null when the segment is missed", () => {
    expect(
      intersectRaySegment(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: -5, y: -5 },
        { x: -5, y: 5 }
      )
    ).toBeNull();
  });
  it("returns null for a parallel segment", () => {
    expect(
      intersectRaySegment(
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 5, y: 5 },
        { x: 10, y: 5 }
      )
    ).toBeNull();
  });
});

describe("getEdges", () => {
  it("returns the four edges of a rect as ordered point pairs", () => {
    expect(getEdges({ x: 0, y: 0, w: 10, h: 10 })).toEqual([
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      [
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      [
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      [
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
    ]);
  });
});
