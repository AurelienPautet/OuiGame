import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { RunTimer } from "../RunTimer";

// Replace requestAnimationFrame directly (rather than vi.stubGlobal) so the
// rAF callback can be advanced deterministically without disturbing the other
// globals the shared test setup relies on (e.g. localStorage).
const realRaf = globalThis.requestAnimationFrame;
const realCaf = globalThis.cancelAnimationFrame;
let frame: FrameRequestCallback | null = null;

describe("RunTimer", () => {
  beforeEach(() => {
    frame = null;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      frame = cb;
      return 1;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame =
      (() => {}) as typeof globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = realRaf;
    globalThis.cancelAnimationFrame = realCaf;
  });

  it("formats the initial elapsed time as m:ss with padded seconds", () => {
    renderWithProviders(<RunTimer getElapsedMs={() => 65_000} />);
    expect(screen.getByText("1:05")).toBeTruthy();
  });

  it("shows zero before play has started", () => {
    renderWithProviders(<RunTimer getElapsedMs={() => 0} />);
    expect(screen.getByText("0:00")).toBeTruthy();
  });

  it("updates the label as elapsed time advances on each frame", () => {
    let ms = 0;
    renderWithProviders(<RunTimer getElapsedMs={() => ms} />);
    expect(screen.getByText("0:00")).toBeTruthy();

    ms = 125_000; // 2:05
    act(() => frame?.(0));
    expect(screen.getByText("2:05")).toBeTruthy();
  });

  it("exposes a labelled timer role for assistive tech", () => {
    renderWithProviders(<RunTimer getElapsedMs={() => 0} />);
    const timer = screen.getByRole("timer");
    expect(timer.getAttribute("aria-label")).toBe("Elapsed run time");
  });
});
