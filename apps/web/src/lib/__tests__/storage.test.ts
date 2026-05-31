import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { storage } from "../storage";

// storage reads window.localStorage at call time, so we install a fresh
// in-memory fake on window before each test (jsdom's localStorage isn't
// reliably writable in this environment — mirrors GameContext.test.tsx).
let store: Record<string, string>;
beforeEach(() => {
  store = {};
  const fake = {
    getItem: (k: string) =>
      Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k: string, v: unknown) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
  vi.stubGlobal("localStorage", fake);
  Object.defineProperty(window, "localStorage", {
    value: fake,
    configurable: true,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("session id", () => {
  it("round-trips set/get/clear and reports presence", () => {
    expect(storage.getSessionId()).toBeNull();
    expect(storage.hasSession()).toBe(false);

    storage.setSessionId("tok123");
    expect(storage.getSessionId()).toBe("tok123");
    expect(storage.hasSession()).toBe(true);

    storage.clearSessionId();
    expect(storage.getSessionId()).toBeNull();
    expect(storage.hasSession()).toBe(false);
  });

  it("treats an empty-string token as no session", () => {
    storage.setSessionId("");
    expect(storage.hasSession()).toBe(false);
  });
});

describe("player name", () => {
  it("round-trips set/get", () => {
    expect(storage.getPlayerName()).toBeNull();
    storage.setPlayerName("Alice");
    expect(storage.getPlayerName()).toBe("Alice");
  });
});

describe("tank colours", () => {
  it("writes all four keys and reads the indices back", () => {
    storage.setTankColors(1, 3, "orange", "green");
    expect(storage.getBodyIndex()).toBe(1);
    expect(storage.getTurretIndex()).toBe(3);
    expect(window.localStorage.getItem("tank_body_color")).toBe("orange");
    expect(window.localStorage.getItem("tank_turret_color")).toBe("green");
  });
  it("returns null for a missing or non-integer index", () => {
    expect(storage.getBodyIndex()).toBeNull();
    window.localStorage.setItem("body", "abc");
    expect(storage.getBodyIndex()).toBeNull();
  });
});

describe("solo selector state", () => {
  it("round-trips JSON and returns null on absence/corruption", () => {
    expect(storage.getSoloSelectorState()).toBeNull();
    storage.setSoloSelectorState({ tab: "mine", page: 2 });
    expect(storage.getSoloSelectorState()).toEqual({ tab: "mine", page: 2 });

    window.localStorage.setItem("soloLevelSelectorState", "{not json");
    expect(storage.getSoloSelectorState()).toBeNull();
  });
});
