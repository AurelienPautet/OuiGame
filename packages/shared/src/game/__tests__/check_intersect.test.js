import { getEdges, intersectRaySegment } from "../check_intersect.js";

// Characterization (golden) tests for the ray/segment geometry used by the bot
// line-of-sight code. Values are captured from the live implementation — any
// diff here is a regression, never a re-baseline. Vitest globals are ambient
// (the `shared` project sets `globals: true`).

describe("getEdges — the four edges of an axis-aligned rectangle (CW from top)", () => {
  it("returns top, right, bottom, left edges for an origin rect", () => {
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

  it("offsets all corners for a non-origin rect", () => {
    const edges = getEdges({ x: 100, y: 50, w: 20, h: 5 });
    expect(edges[0]).toEqual([
      { x: 100, y: 50 },
      { x: 120, y: 50 },
    ]);
    expect(edges[2]).toEqual([
      { x: 120, y: 55 },
      { x: 100, y: 55 },
    ]);
  });
});

describe("intersectRaySegment", () => {
  const origin = { x: 0, y: 0 };
  const right = { x: 1, y: 0 }; // ray pointing +x

  it("returns the hit point + distance when the ray crosses the segment", () => {
    // Vertical segment at x=5 spanning y∈[-5,5]; +x ray from origin hits (5,0).
    const hit = intersectRaySegment(
      origin,
      right,
      { x: 5, y: -5 },
      { x: 5, y: 5 }
    );
    expect(hit).toEqual({ x: 5, y: 0, dist: 5 });
  });

  it("returns null for a parallel segment (det === 0)", () => {
    expect(
      intersectRaySegment(origin, right, { x: 0, y: 5 }, { x: 10, y: 5 })
    ).toBeNull();
  });

  it("returns null when the intersection is behind the ray origin (s < 0)", () => {
    expect(
      intersectRaySegment(origin, right, { x: -5, y: -5 }, { x: -5, y: 5 })
    ).toBeNull();
  });

  it("returns null when the crossing falls off the segment (t outside [0,1])", () => {
    // Segment sits entirely above the ray line.
    expect(
      intersectRaySegment(origin, right, { x: 5, y: 5 }, { x: 5, y: 15 })
    ).toBeNull();
  });

  it("includes the t=0 segment endpoint (boundary is inclusive)", () => {
    const hit = intersectRaySegment(
      origin,
      right,
      { x: 5, y: 0 },
      { x: 5, y: 10 }
    );
    expect(hit).toEqual({ x: 5, y: 0, dist: 5 });
  });

  it("includes the t=1 segment endpoint (boundary is inclusive)", () => {
    const hit = intersectRaySegment(
      origin,
      right,
      { x: 5, y: -10 },
      { x: 5, y: 0 }
    );
    expect(hit).toEqual({ x: 5, y: 0, dist: 5 });
  });
});
