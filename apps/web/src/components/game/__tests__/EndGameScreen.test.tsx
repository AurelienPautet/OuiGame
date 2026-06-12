import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, act } from "@testing-library/react";

// The end screen reads the socket (winner/level events), auth (rating gate)
// and toasts; the rating/leaderboard queries come from hooks/api. All faked —
// the unit under test is the winner-payload handling.
const { fakeSocket } = vi.hoisted(() => ({
  fakeSocket: {
    id: "me-sid",
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
}));
vi.mock("../../../contexts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../contexts")>();
  return {
    ...actual,
    useSocket: () => ({ socket: fakeSocket }),
    useAuth: () => ({ user: null }),
    useToast: () => ({ addToast: vi.fn() }),
  };
});
vi.mock("../../../hooks/api", () => ({
  useRateLevel: () => ({
    mutate: vi.fn(),
    isSuccess: false,
    isError: false,
    data: undefined,
    variables: undefined,
    error: null,
  }),
  useLevelLeaderboard: () => ({ data: [] }),
}));
vi.mock("../../../audio", () => ({ playSfx: vi.fn() }));

import { renderWithProviders } from "../../../test/renderWithProviders";
import { EndGameScreen } from "../EndGameScreen";
import type { WinnerPayload } from "@ouigame/shared/types";

const basePayload = (over: Partial<WinnerPayload> = {}): WinnerPayload => ({
  socketid: "me-sid",
  waitingtime: 5000,
  player_scores: {
    "me-sid": {
      wins: 1,
      kills: 2,
      deaths: 0,
      shots: 5,
      hits: 3,
      plants: 0,
      blocks_destroyed: 0,
    },
    lobbybot_0: {
      wins: 0,
      kills: 0,
      deaths: 1,
      shots: 4,
      hits: 1,
      plants: 0,
      blocks_destroyed: 0,
    },
  },
  ids_to_name: { "me-sid": "Alice", lobbybot_0: "Bot 1" },
  ...over,
});

function winnerHandler(): (data: WinnerPayload) => void {
  const call = fakeSocket.on.mock.calls.find(([event]) => event === "winner");
  return call?.[1] as (data: WinnerPayload) => void;
}

beforeEach(() => {
  fakeSocket.on.mockClear();
});

describe("EndGameScreen — winner payloads", () => {
  it("a coop win renders the team verdict and the scoreboard", () => {
    renderWithProviders(
      <EndGameScreen onReplay={() => {}} onQuit={() => {}} />
    );
    act(() => {
      winnerHandler()(basePayload({ socketid: "teammate-sid", coop: "win" }));
    });
    expect(screen.getByText("Victory — all bots destroyed!")).toBeTruthy();
    // The regular score table still renders under the verdict.
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Bot 1")).toBeTruthy();
  });

  it("a coop loss renders Defeat even though socketid is -1 (not a draw)", () => {
    renderWithProviders(
      <EndGameScreen onReplay={() => {}} onQuit={() => {}} />
    );
    act(() => {
      winnerHandler()(basePayload({ socketid: -1, coop: "loss" }));
    });
    expect(screen.getByText(/defeat — your team was wiped out/i)).toBeTruthy();
  });

  it("an ffa payload without the coop key keeps the legacy framing", () => {
    renderWithProviders(
      <EndGameScreen onReplay={() => {}} onQuit={() => {}} />
    );
    act(() => {
      winnerHandler()(basePayload());
    });
    expect(screen.getByText("You Won!")).toBeTruthy();
  });
});
