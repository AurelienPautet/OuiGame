import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_BOT_SYSTEM, resolveBotSystem } from "../botSystem";
import { storage } from "../storage";

// Resolution precedence: ?bots= in location.search > ?bots= inside the hash
// (HashRouter) > localStorage dev toggle > DEFAULT_BOT_SYSTEM. Garbage values
// at any level fall through to the next. This file must not import anything
// from @ouigame/shared (CI's unit job builds no shared dist).

const setUrl = (searchAndHash: string) => {
  window.history.replaceState(null, "", `/${searchAndHash}`);
};

beforeEach(() => {
  window.localStorage.clear();
  setUrl("");
});

describe("resolveBotSystem", () => {
  it("defaults when nothing is set", () => {
    expect(resolveBotSystem()).toBe(DEFAULT_BOT_SYSTEM);
  });

  it("reads ?bots= from the search string (before the hash)", () => {
    setUrl("?bots=v2#/");
    expect(resolveBotSystem()).toBe("v2");
    setUrl("?bots=legacy#/");
    expect(resolveBotSystem()).toBe("legacy");
  });

  it("reads ?bots= from inside the hash (HashRouter route query)", () => {
    setUrl("#/play?bots=v2");
    expect(resolveBotSystem()).toBe("v2");
  });

  it("search wins over hash, hash wins over localStorage", () => {
    storage.setBotSystem("legacy");
    setUrl("?bots=v2#/play?bots=legacy");
    expect(resolveBotSystem()).toBe("v2");

    setUrl("#/play?bots=v2");
    expect(resolveBotSystem()).toBe("v2");
  });

  it("falls back to the localStorage dev toggle", () => {
    storage.setBotSystem("v2");
    expect(resolveBotSystem()).toBe("v2");
  });

  it("ignores garbage values at every level", () => {
    storage.setBotSystem("banana");
    setUrl("?bots=quantum#/play?bots=42");
    expect(resolveBotSystem()).toBe(DEFAULT_BOT_SYSTEM);
  });
});
