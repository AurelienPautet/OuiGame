import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useWindowScale } from "./useWindowScale";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants/canvas";

// Drive the hook by faking the window dimensions + devicePixelRatio it reads,
// then firing a resize so it recomputes. Originals are captured so afterEach can
// restore them — these are global mutations that would otherwise leak into other
// test files sharing the worker.
const ORIGINALS = ["innerWidth", "innerHeight", "devicePixelRatio"].map(
  (prop) => [prop, Object.getOwnPropertyDescriptor(window, prop)] as const
);

function setWindow(width: number, height: number, dpr: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: dpr,
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Restore the real window descriptors (setWindow used defineProperty, which
  // restoreAllMocks does not undo).
  for (const [prop, desc] of ORIGINALS) {
    if (desc) Object.defineProperty(window, prop, desc);
    else delete (window as unknown as Record<string, unknown>)[prop];
  }
});

describe("useWindowScale", () => {
  it("fits the whole stage when the window is smaller than the virtual stage (never collapses to 0)", () => {
    // Window shorter than the 800px-tall stage at dpr 1: the old
    // `Math.floor(raw * dpr) / dpr` floored 0.85 → 0, hiding the entire game.
    setWindow(CANVAS_WIDTH, Math.round(CANVAS_HEIGHT * 0.85), 1);
    const { result } = renderHook(() => useWindowScale());
    expect(result.current).toBeCloseTo(0.85, 5);
  });

  it("uses the exact contain ratio for any down-scale (small screens stay visible)", () => {
    setWindow(Math.round(CANVAS_WIDTH * 0.6), CANVAS_HEIGHT, 1);
    const { result } = renderHook(() => useWindowScale());
    // width is the limiting axis → ~0.6, and it must be positive.
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeCloseTo(0.6, 5);
  });

  it("snaps an integer up-scale to whole device pixels (dpr 1)", () => {
    // Window 2× the stage on both axes at dpr 1 → scale 2 exactly.
    setWindow(CANVAS_WIDTH * 2, CANVAS_HEIGHT * 2, 1);
    const { result } = renderHook(() => useWindowScale());
    expect(result.current).toBe(2);
  });

  it("snaps a fractional up-scale down to the nearest 1/dpr step (dpr 2)", () => {
    // raw 1.4 at dpr 2 → floor(2.8)/2 = 1.0 (not 1.4), keeping device-pixel snap.
    setWindow(
      Math.round(CANVAS_WIDTH * 1.4),
      Math.round(CANVAS_HEIGHT * 1.4),
      2
    );
    const { result } = renderHook(() => useWindowScale());
    expect(result.current).toBe(1);
  });

  it("recomputes on window resize", () => {
    setWindow(CANVAS_WIDTH, CANVAS_HEIGHT, 1);
    const { result } = renderHook(() => useWindowScale());
    expect(result.current).toBe(1);

    act(() => {
      setWindow(Math.round(CANVAS_WIDTH * 0.5), CANVAS_HEIGHT, 1);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBeCloseTo(0.5, 5);
  });
});
