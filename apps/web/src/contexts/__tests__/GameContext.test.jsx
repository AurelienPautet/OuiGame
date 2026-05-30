import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { GameProvider, useGame } from "../GameContext";
import { STARTING_LIVES, LIFE_EVERY } from "../../constants/campaign";

// Characterization tests for the GameContext run-state machine (solo / online /
// campaign). They freeze the campaignAdvance / campaignLoseLife / runNonce
// branch behaviour so refactors can't silently change the campaign flow.
// Date.now is mocked so the timeMs in run results is deterministic.

const renderGame = () =>
  renderHook(() => useGame(), {
    wrapper: ({ children }) => <GameProvider>{children}</GameProvider>,
  });

let now;
let store;
beforeEach(() => {
  now = 1000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  // Stub a clean localStorage (jsdom's is not reliably writable here) so
  // playerName / tank colours are deterministic across tests.
  store = {};
  vi.stubGlobal("localStorage", {
    getItem: (k) =>
      Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("initial state", () => {
  it("starts idle with runNonce 0 and no lives", () => {
    const { result } = renderGame();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.mode).toBe(null);
    expect(result.current.runNonce).toBe(0);
    expect(result.current.lives).toBe(0);
  });
});

describe("startSoloGame", () => {
  it("enters solo mode and bumps runNonce", () => {
    const { result } = renderGame();
    act(() => result.current.startSoloGame(42));
    expect(result.current.mode).toBe("solo");
    expect(result.current.levelId).toBe(42);
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.roomId).toBe(null);
    expect(result.current.runNonce).toBe(1);
  });

  it("uses the stored playerName when present", () => {
    localStorage.setItem("playerName", "Ada");
    const { result } = renderGame();
    act(() => result.current.startSoloGame(1));
    expect(result.current.playerName).toBe("Ada");
  });
});

describe("startOnlineGame", () => {
  it("enters online mode without bumping runNonce", () => {
    const { result } = renderGame();
    act(() => result.current.startOnlineGame("room-7"));
    expect(result.current.mode).toBe("online");
    expect(result.current.roomId).toBe("room-7");
    expect(result.current.levelId).toBe(null);
    expect(result.current.runNonce).toBe(0); // online start does NOT bump it
  });
});

describe("startCampaign", () => {
  it("sets up the run with STARTING_LIVES and the first level", () => {
    const { result } = renderGame();
    act(() =>
      result.current.startCampaign({ campaignId: 7, levelIds: [10, 20, 30] })
    );
    expect(result.current.mode).toBe("campaign");
    expect(result.current.campaignId).toBe(7);
    expect(result.current.campaignLevelIds).toEqual([10, 20, 30]);
    expect(result.current.campaignIndex).toBe(0);
    expect(result.current.levelId).toBe(10);
    expect(result.current.lives).toBe(STARTING_LIVES);
    expect(result.current.runNonce).toBe(1);
  });

  it("is a no-op for empty levelIds", () => {
    const { result } = renderGame();
    act(() => result.current.startCampaign({ campaignId: 7, levelIds: [] }));
    expect(result.current.mode).toBe(null);
    expect(result.current.isPlaying).toBe(false);
  });
});

describe("campaignAdvance", () => {
  it("advances to the next level (no life gain) and bumps runNonce", () => {
    const { result } = renderGame();
    act(() =>
      result.current.startCampaign({ campaignId: 1, levelIds: [10, 20, 30] })
    );
    let outcome;
    act(() => {
      outcome = result.current.campaignAdvance();
    });
    expect(outcome).toEqual({
      type: "next",
      gainedLife: false,
      nextLevelId: 20,
    });
    expect(result.current.campaignIndex).toBe(1);
    expect(result.current.levelId).toBe(20);
    expect(result.current.lives).toBe(STARTING_LIVES);
    expect(result.current.runNonce).toBe(2); // 1 (start) + 1 (advance)
  });

  it("completes the run on the last level", () => {
    const { result } = renderGame();
    act(() =>
      result.current.startCampaign({ campaignId: 1, levelIds: [10, 20] })
    );
    act(() => {
      result.current.campaignAdvance(); // -> level 20 (index 1)
    });
    now = 1500; // 500ms after runStartTime (1000)
    let outcome;
    act(() => {
      outcome = result.current.campaignAdvance();
    });
    expect(outcome.type).toBe("complete");
    expect(outcome.completed).toBe(true);
    expect(outcome.levelsCleared).toBe(2);
    expect(outcome.timeMs).toBe(500);
    expect(result.current.campaignRunResult).toMatchObject({
      completed: true,
      levelsCleared: 2,
    });
  });

  it("grants a life every LIFE_EVERY levels cleared", () => {
    const { result } = renderGame();
    // Need more than LIFE_EVERY levels so the LIFE_EVERY-th clear is a 'next'.
    const ids = Array.from({ length: LIFE_EVERY + 1 }, (_, i) => i + 1);
    act(() => result.current.startCampaign({ campaignId: 1, levelIds: ids }));
    let outcome;
    for (let i = 0; i < LIFE_EVERY; i++) {
      act(() => {
        outcome = result.current.campaignAdvance();
      });
    }
    expect(outcome.gainedLife).toBe(true);
    expect(result.current.lives).toBe(STARTING_LIVES + 1);
    expect(result.current.campaignIndex).toBe(LIFE_EVERY);
  });
});

describe("campaignLoseLife", () => {
  it("retries with one fewer life while lives remain", () => {
    const { result } = renderGame();
    act(() =>
      result.current.startCampaign({ campaignId: 1, levelIds: [10, 20] })
    );
    let outcome;
    act(() => {
      outcome = result.current.campaignLoseLife();
    });
    expect(outcome).toEqual({ type: "retry" });
    expect(result.current.lives).toBe(STARTING_LIVES - 1);
    expect(result.current.runNonce).toBe(2);
  });

  it("ends the run as 'over' when the last life is lost", () => {
    const { result } = renderGame();
    act(() =>
      result.current.startCampaign({ campaignId: 1, levelIds: [10, 20] })
    );
    // STARTING_LIVES - 1 retries bring lives down to 1; the final loss (after
    // the loop) ends the run.
    for (let i = 0; i < STARTING_LIVES - 1; i++) {
      act(() => {
        result.current.campaignLoseLife();
      });
    }
    now = 2000;
    let outcome;
    act(() => {
      outcome = result.current.campaignLoseLife();
    });
    expect(outcome.type).toBe("over");
    expect(outcome.completed).toBe(false);
    expect(outcome.livesLeft).toBe(0);
    expect(outcome.timeMs).toBe(1000); // 2000 - 1000
    expect(result.current.lives).toBe(0);
  });
});

describe("quitGame / cycleTheme", () => {
  it("quitGame resets to initial state but preserves the theme", () => {
    const { result } = renderGame();
    act(() => result.current.cycleTheme()); // theme 1 -> 2
    act(() => result.current.startSoloGame(5));
    act(() => result.current.quitGame());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.mode).toBe(null);
    expect(result.current.theme).toBe(2); // preserved across quit
  });

  it("cycleTheme wraps 1..6 back to 1", () => {
    const { result } = renderGame();
    expect(result.current.theme).toBe(1);
    for (let i = 0; i < 5; i++) act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe(6);
    act(() => result.current.cycleTheme());
    expect(result.current.theme).toBe(1);
  });
});
