import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";

// The overlay reads only the socket (id for host detection, emit for the
// controls); replace useSocket and keep everything else real.
const { fakeSocket } = vi.hoisted(() => ({
  fakeSocket: {
    id: "host-sid",
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
  };
});

import { renderWithProviders } from "../../../test/renderWithProviders";
import { LobbyOverlay } from "../LobbyOverlay";
import type { LobbyState } from "@ouigame/shared/types";

function mkState(overrides: Partial<LobbyState> = {}): LobbyState {
  return {
    room_id: 1,
    name: "Mardi Soir",
    status: "lobby",
    mode: "ffa",
    max_players: 4,
    members: [
      {
        socketid: "host-sid",
        name: "Alice",
        turretc: "orange",
        bodyc: "blue",
        is_bot: false,
        is_host: true,
      },
      {
        socketid: "guest-sid",
        name: "Marc",
        turretc: "green",
        bodyc: "green",
        is_bot: false,
        is_host: false,
      },
      {
        socketid: "lobbybot_0",
        name: "Bot 1",
        turretc: "dimgray",
        bodyc: "dimgray",
        is_bot: true,
        is_host: false,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  fakeSocket.emit.mockClear();
});

describe("LobbyOverlay", () => {
  it("renders the room name and every member, tagging bots and the host", () => {
    renderWithProviders(
      <LobbyOverlay state={mkState()} roomId={1} onLeave={() => {}} />
    );
    expect(screen.getByText("Mardi Soir")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("Marc")).toBeTruthy();
    expect(screen.getByText("Bot 1")).toBeTruthy();
    expect(screen.getByText("Bot")).toBeTruthy(); // the BOT tag
    expect(screen.getByText("3/4")).toBeTruthy(); // ffa: every combatant
  });

  it("host sees the controls and the emits carry the room id", () => {
    renderWithProviders(
      <LobbyOverlay state={mkState()} roomId={1} onLeave={() => {}} />
    );
    fireEvent.click(screen.getByRole("button", { name: /add bot/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("lobby_add_bot", 1);

    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith("lobby_start", 1);

    fireEvent.click(screen.getByRole("button", { name: /remove bot/i }));
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      "lobby_remove_bot",
      1,
      "lobbybot_0"
    );
  });

  it("a non-host gets the waiting line instead of controls", () => {
    fakeSocket.id = "guest-sid";
    renderWithProviders(
      <LobbyOverlay state={mkState()} roomId={1} onLeave={() => {}} />
    );
    expect(screen.getByText(/waiting for the host/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /start game/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /add bot/i })).toBeNull();
    fakeSocket.id = "host-sid";
  });

  it("coop rooms have no Add bot (the level brings the bots) and count humans", () => {
    renderWithProviders(
      <LobbyOverlay
        state={mkState({ mode: "coop" })}
        roomId={1}
        onLeave={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: /add bot/i })).toBeNull();
    expect(screen.getByText("2/4")).toBeTruthy(); // humans only
    expect(screen.getByRole("button", { name: /start game/i })).toBeTruthy();
  });

  it("disables Add bot at capacity and Start for a lone ffa human", () => {
    const lone = mkState({
      members: [
        {
          socketid: "host-sid",
          name: "Alice",
          turretc: "orange",
          bodyc: "blue",
          is_bot: false,
          is_host: true,
        },
      ],
      max_players: 1,
    });
    renderWithProviders(
      <LobbyOverlay state={lone} roomId={1} onLeave={() => {}} />
    );
    expect(
      (screen.getByRole("button", { name: /add bot/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: /start game/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("Leave fires the provided handler", () => {
    const onLeave = vi.fn();
    renderWithProviders(
      <LobbyOverlay state={mkState()} roomId={1} onLeave={onLeave} />
    );
    fireEvent.click(screen.getByRole("button", { name: /leave/i }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("renders nothing once the room is playing", () => {
    const { container } = renderWithProviders(
      <LobbyOverlay
        state={mkState({ status: "playing" })}
        roomId={1}
        onLeave={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
