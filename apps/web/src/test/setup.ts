// Vitest setup for the web (jsdom) project. Runs once per test file before the
// suite. Two jobs:
//  1. Unmount React trees between tests so portals (Radix Dialog/Tooltip) and
//     their document.body nodes/listeners don't leak across cases.
//  2. Polyfill the handful of DOM APIs jsdom omits that Radix UI primitives
//     touch on mount (matchMedia, ResizeObserver, scrollIntoView, pointer
//     capture). Without these, rendering a Dialog/Tooltip throws in jsdom.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const proto = Element.prototype as unknown as Record<string, unknown>;
proto.scrollIntoView ??= () => {};
proto.hasPointerCapture ??= () => false;
proto.setPointerCapture ??= () => {};
proto.releasePointerCapture ??= () => {};

// jsdom has no canvas backend; components that draw (TankAvatar) already guard
// on a null context, so return null instead of letting jsdom log a noisy
// "Not implemented: getContext" error on every render.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as typeof HTMLCanvasElement.prototype.getContext;
