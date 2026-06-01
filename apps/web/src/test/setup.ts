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
  // Reset persisted browser state between tests. The i18n LanguageDetector and
  // storage.* both read/write localStorage, so without this a test that renders
  // directly (without renderWithProviders) could inherit the previous test's
  // language or saved tank indices — an order-dependent flake.
  localStorage.clear();
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

// jsdom has no canvas backend, so getContext throws "Not implemented" — noisy,
// and components that draw (TankAvatar) already guard on a null context. Wrap
// (don't clobber) the original: try it, fall back to null only when it throws.
// This stays correct if a real canvas backend (e.g. the `canvas` package) is
// ever added — the original implementation is then used.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  ...args: Parameters<typeof originalGetContext>
) {
  try {
    return originalGetContext.apply(this, args);
  } catch {
    return null;
  }
} as typeof HTMLCanvasElement.prototype.getContext;
