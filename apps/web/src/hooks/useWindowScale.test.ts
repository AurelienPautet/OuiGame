import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useWindowScale } from "./useWindowScale";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../constants/canvas";

// Drive the hook by faking the window dimensions + devicePixelRatio it reads,
// then firing a resize so it recomputes.
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

  it("snaps up-scaling to whole device pixels to stay crisp", () => {
    // Window 1.4× the stage on both axes at dpr 1 → snap 1.4 down to 1.
    setWindow(CANVAS_WIDTH * 2, CANVAS_HEIGHT * 2, 1);
    const { result } = renderHook(() => useWindowScale());
    expect(result.current).toBe(2);

    // dpr 2: 1.4 snaps to the nearest 1/2 below → 1.0 (not 1.4).
    setWindow(
      Math.round(CANVAS_WIDTH * 1.4),
      Math.round(CANVAS_HEIGHT * 1.4),
      2
    );
    const { result: r2 } = renderHook(() => useWindowScale());
    expect(r2.current).toBe(1);
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
