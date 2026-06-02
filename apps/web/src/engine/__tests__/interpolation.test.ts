import { describe, it, expect } from "vitest";
import {
  lerp,
  clamp,
  lerpAngle,
  lerpPose,
  poseOf,
  withPose,
  sampleBuffer,
  pruneBuffer,
  type TimedFrame,
} from "../interpolation.js";

describe("lerp / clamp", () => {
  it("interpolates linearly", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });
  it("clamps into range", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe("lerpAngle (shortest arc)", () => {
  it("interpolates within a simple range", () => {
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 12);
  });
  it("crosses the ±π wrap the short way, not the long way", () => {
    // From 170° to -170° is a +20° step across the wrap, not -340°.
    const a = (170 * Math.PI) / 180;
    const b = (-170 * Math.PI) / 180;
    const mid = lerpAngle(a, b, 0.5);
    // Halfway should be ±180° (≈ ±π), i.e. cos(mid) ≈ -1.
    expect(Math.cos(mid)).toBeCloseTo(-1, 12);
  });
  it("returns the endpoints at t=0 and t=1", () => {
    expect(lerpAngle(1, 2, 0)).toBeCloseTo(1, 12);
    expect(lerpAngle(1, 2, 1)).toBeCloseTo(2, 12);
  });
});

describe("poseOf / withPose / lerpPose", () => {
  it("reads and writes pose without losing other fields", () => {
    const entity = {
      position: { x: 1, y: 2 },
      angle: 0.5,
      rotation: 45,
      color: "red",
    };
    expect(poseOf(entity)).toEqual({ x: 1, y: 2, angle: 0.5, rotation: 45 });

    const moved = withPose(entity, { x: 9, y: 8, angle: 1, rotation: 90 });
    expect(moved.position).toEqual({ x: 9, y: 8 });
    expect(moved.angle).toBe(1);
    expect(moved.rotation).toBe(90);
    expect(moved.color).toBe("red"); // carried through
    expect(entity.position).toEqual({ x: 1, y: 2 }); // original untouched
  });

  it("interpolates a full pose", () => {
    const a = { x: 0, y: 0, angle: 0 };
    const b = { x: 10, y: 20, angle: Math.PI / 2 };
    const mid = lerpPose(a, b, 0.5);
    expect(mid.x).toBe(5);
    expect(mid.y).toBe(10);
    expect(mid.angle).toBeCloseTo(Math.PI / 4, 12);
  });
});

describe("sampleBuffer", () => {
  const buf: TimedFrame<string>[] = [
    { t: 100, state: "a" },
    { t: 200, state: "b" },
    { t: 300, state: "c" },
  ];

  it("returns null for an empty buffer", () => {
    expect(sampleBuffer([], 123)).toBeNull();
  });

  it("holds the oldest frame when render time precedes it", () => {
    const s = sampleBuffer(buf, 50)!;
    expect(s.a.state).toBe("a");
    expect(s.b.state).toBe("a");
    expect(s.alpha).toBe(0);
  });

  it("blends between the two straddling frames", () => {
    const s = sampleBuffer(buf, 250)!;
    expect(s.a.state).toBe("b");
    expect(s.b.state).toBe("c");
    expect(s.alpha).toBeCloseTo(0.5, 12);
  });

  it("holds the newest frame when render time is in the future", () => {
    const s = sampleBuffer(buf, 999)!;
    expect(s.a.state).toBe("c");
    expect(s.b.state).toBe("c");
    expect(s.alpha).toBe(0);
  });
});

describe("pruneBuffer", () => {
  it("drops frames older than the cutoff but keeps the latest", () => {
    const buf: TimedFrame<number>[] = [
      { t: 0, state: 0 },
      { t: 100, state: 1 },
      { t: 200, state: 2 },
    ];
    pruneBuffer(buf, 150);
    expect(buf.map((f) => f.t)).toEqual([200]);
  });

  it("never empties the buffer", () => {
    const buf: TimedFrame<number>[] = [{ t: 0, state: 0 }];
    pruneBuffer(buf, 9999);
    expect(buf).toHaveLength(1);
  });
});
