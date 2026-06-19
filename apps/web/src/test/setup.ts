// Vitest setup for the web (jsdom) project. Runs once per test file before the
// suite. Two jobs:
//  1. Unmount React trees between tests so portals (Radix Dialog/Tooltip) and
//     their document.body nodes/listeners don't leak across cases.
//  2. Polyfill the handful of DOM APIs jsdom omits that Radix UI primitives
//     touch on mount (matchMedia, ResizeObserver, scrollIntoView, pointer
//     capture). Without these, rendering a Dialog/Tooltip throws in jsdom.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Guarantee a working Storage. jsdom normally provides one, but Node 25 exposes
// its own experimental `localStorage` global that shadows jsdom's and lacks the
// Storage methods (getItem/setItem/clear), which makes every `storage.*` call —
// and the afterEach reset below — throw. Detect that broken global and replace
// it (on both `globalThis` and `window`) with a real in-memory Storage. On
// Node 24 / CI, jsdom's own localStorage already works, so this is a no-op.
if (typeof globalThis.localStorage?.clear !== "function") {
  class MemoryStorage implements Storage {
    #map = new Map<string, string>();
    get length(): number {
      return this.#map.size;
    }
    clear(): void {
      this.#map.clear();
    }
    getItem(key: string): string | null {
      return this.#map.has(key) ? (this.#map.get(key) as string) : null;
    }
    key(index: number): string | null {
      return Array.from(this.#map.keys())[index] ?? null;
    }
    removeItem(key: string): void {
      this.#map.delete(key);
    }
    setItem(key: string, value: string): void {
      this.#map.set(key, String(value));
    }
  }
  const store = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: store,
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: store,
  });
}

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
