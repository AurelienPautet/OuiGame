// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AdminConnectedPlayersResponse } from "@ouigame/shared/api";
import { ConnectedPlayersSection } from "../ConnectedPlayersSection";

const useAdminConnectedPlayers = vi.fn();
const mockRefetch = vi.fn();

vi.mock("../../../hooks/api", () => ({
  useAdminConnectedPlayers: (params?: any, options?: any) =>
    useAdminConnectedPlayers(params, options),
  useAdminUser: vi.fn().mockReturnValue({ data: undefined, isLoading: true }),
}));

vi.mock("../UserDetailModal", () => ({
  UserDetailModal: ({
    userId,
    onClose,
  }: {
    userId: number;
    onClose: () => void;
  }) => (
    <div data-testid="user-detail-modal">
      <span>Modal for User {userId}</span>
      <button onClick={onClose}>Close Modal</button>
    </div>
  ),
}));

const SAMPLE_DATA: AdminConnectedPlayersResponse = {
  total: 3,
  registeredCount: 2,
  guestCount: 1,
  players: [
    {
      socketId: "sock-reg-1",
      clientId: "client-reg-uuid-1",
      type: "registered",
      connectedAt: "2026-06-19T10:00:00.000Z",
      durationMs: 125000, // 2m 5s
      ip: "192.168.1.100",
      status: "playing",
      room: {
        id: 42,
        name: "Neon Fortress",
        mode: "coop",
        status: "playing",
      },
      user: {
        id: 7,
        username: "AceCommander",
        email: "ace@example.com",
        isAdmin: true,
      },
      guestName: null,
    },
    {
      socketId: "sock-reg-2",
      clientId: "client-reg-uuid-2",
      type: "registered",
      connectedAt: "2026-06-19T10:01:00.000Z",
      durationMs: 65000, // 1m 5s
      ip: "10.0.0.5",
      status: "in_room",
      room: {
        id: 99,
        name: "Desert Arena",
        mode: "ffa",
        status: "lobby",
      },
      user: {
        id: 15,
        username: "TankBuster",
        email: "tank@example.com",
        isAdmin: false,
      },
      guestName: null,
    },
    {
      socketId: "sock-guest-1",
      clientId: "client-guest-xyz-12345678",
      type: "guest",
      connectedAt: "2026-06-19T10:02:00.000Z",
      durationMs: 15000, // 15s
      ip: "172.16.0.22",
      status: "lobby",
      room: null,
      user: null,
      guestName: "SpeedyGuest",
    },
  ],
};

describe("ConnectedPlayersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAdminConnectedPlayers.mockReturnValue({
      data: SAMPLE_DATA,
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });
  });

  it("renders live header stats with counts and badges", () => {
    render(<ConnectedPlayersSection />);

    expect(screen.getByText("Connected Players")).toBeTruthy();
    expect(screen.getByText("3 Online")).toBeTruthy();
    expect(screen.getByText(/2 registered · 1 guest/)).toBeTruthy();
  });

  it("renders details for both registered and guest players", () => {
    render(<ConnectedPlayersSection />);

    // Registered player 1
    expect(screen.getByText("AceCommander")).toBeTruthy();
    expect(screen.getByText("ace@example.com")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
    expect(screen.getByText(/Playing in #42/)).toBeTruthy();
    expect(screen.getByText(/Neon Fortress/)).toBeTruthy();
    expect(screen.getByText("192.168.1.100")).toBeTruthy();

    // Registered player 2
    expect(screen.getByText("TankBuster")).toBeTruthy();
    expect(screen.getByText("tank@example.com")).toBeTruthy();
    expect(screen.getByText(/In Room #99/)).toBeTruthy();
    expect(screen.getByText(/Desert Arena/)).toBeTruthy();
    expect(screen.getByText("10.0.0.5")).toBeTruthy();

    // Guest player
    expect(screen.getByText("SpeedyGuest")).toBeTruthy();
    expect(screen.getByText("client-guest-xyz-12345678")).toBeTruthy();
    expect(screen.getByText("Main Lobby")).toBeTruthy();
    expect(screen.getByText("172.16.0.22")).toBeTruthy();
  });

  it("filters player list by type tabs (All, Registered, Guests)", () => {
    render(<ConnectedPlayersSection />);

    // Click Registered tab
    const regTab = screen.getByRole("button", { name: "Registered (2)" });
    fireEvent.click(regTab);

    expect(screen.getByText("AceCommander")).toBeTruthy();
    expect(screen.getByText("TankBuster")).toBeTruthy();
    expect(screen.queryByText("SpeedyGuest")).toBeNull();

    // Click Guests tab
    const guestTab = screen.getByRole("button", { name: "Guests (1)" });
    fireEvent.click(guestTab);

    expect(screen.getByText("SpeedyGuest")).toBeTruthy();
    expect(screen.queryByText("AceCommander")).toBeNull();
    expect(screen.queryByText("TankBuster")).toBeNull();
  });

  it("filters player list by search term", () => {
    render(<ConnectedPlayersSection />);

    const searchInput = screen.getByLabelText("Search connected players");

    // Search by username
    fireEvent.change(searchInput, { target: { value: "buster" } });
    expect(screen.getByText("TankBuster")).toBeTruthy();
    expect(screen.queryByText("AceCommander")).toBeNull();
    expect(screen.queryByText("SpeedyGuest")).toBeNull();

    // Search by guest nickname
    fireEvent.change(searchInput, { target: { value: "speedy" } });
    expect(screen.getByText("SpeedyGuest")).toBeTruthy();
    expect(screen.queryByText("TankBuster")).toBeNull();

    // Search by IP
    fireEvent.change(searchInput, { target: { value: "192.168" } });
    expect(screen.getByText("AceCommander")).toBeTruthy();
    expect(screen.queryByText("SpeedyGuest")).toBeNull();

    // Search with no results
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });
    expect(
      screen.getByText("No connected players match your search filter.")
    ).toBeTruthy();
  });

  it("opens UserDetailModal when clicking Inspect or registered username", () => {
    render(<ConnectedPlayersSection />);

    // Click username for AceCommander
    const userBtn = screen.getByRole("button", { name: "AceCommander" });
    fireEvent.click(userBtn);

    expect(screen.getByTestId("user-detail-modal")).toBeTruthy();
    expect(screen.getByText("Modal for User 7")).toBeTruthy();

    // Close modal
    fireEvent.click(screen.getByText("Close Modal"));
    expect(screen.queryByTestId("user-detail-modal")).toBeNull();
  });

  it("toggles auto-refresh state and triggers manual refresh", () => {
    render(<ConnectedPlayersSection />);

    const toggleBtn = screen.getByTitle("Auto-refresh active (5s)");
    expect(toggleBtn.textContent).toBe("Live (5s)");

    fireEvent.click(toggleBtn);
    expect(screen.getByTitle("Auto-refresh paused").textContent).toBe("Paused");

    const refreshBtn = screen.getByLabelText("Refresh connected players");
    fireEvent.click(refreshBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renders empty state when there are no connected players", () => {
    useAdminConnectedPlayers.mockReturnValue({
      data: {
        total: 0,
        registeredCount: 0,
        guestCount: 0,
        players: [],
      },
      isLoading: false,
      isFetching: false,
      refetch: mockRefetch,
    });

    render(<ConnectedPlayersSection />);
    expect(
      screen.getByText("No players currently connected to the server.")
    ).toBeTruthy();
  });
});
