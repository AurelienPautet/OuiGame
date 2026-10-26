// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { AdminOverview, AdminTimeseriesPoint } from "@ouigame/shared/api";
import { OverviewTab } from "../OverviewTab";

// Mock the data layer so the tab renders against fixed sample data with no
// network / QueryClient involvement.
const useAdminOverview = vi.fn();
const useAdminTimeseries = vi.fn();
const useAdminConnectedPlayers = vi.fn();
vi.mock("../../../hooks/api", () => ({
  useAdminOverview: () => useAdminOverview(),
  useAdminTimeseries: (days: any) => useAdminTimeseries(days),
  useAdminConnectedPlayers: (params?: any, options?: any) =>
    useAdminConnectedPlayers(params, options),
}));

const OVERVIEW: AdminOverview = {
  players: {
    total: 1284,
    db: 900,
    google: 384,
    admins: 3,
    newToday: 5,
    new7d: 42,
    new30d: 130,
    activeToday: 60,
    active7d: 210,
    active30d: 540,
    guestsToday: 15,
    connected: {
      total: 7,
      registered: 4,
      guests: 3,
    },
  },
  content: {
    levels: 80,
    levelsUp: 64,
    levelsDown: 16,
    campaigns: 12,
    ratings: 350,
  },
  games: {
    onlineRounds: 4000,
    soloRounds: 9000,
    campaignRuns: 700,
    total: 13700,
  },
  combat: {
    kills: 50000,
    deaths: 48000,
    wins: 2300,
    shots: 200000,
    hits: 90000,
    accuracy: 0.45,
    blocksDestroyed: 12000,
    plants: 800,
  },
  solo: {
    completions: 600,
    attempts: 1500,
    completionRate: 0.4,
    distinctLevelsCompleted: 70,
  },
  playtime: {
    soloMs: 3 * 3_600_000, // 3h
    onlineMs: 90 * 60_000, // 1h30m
    sessionMs: 6 * 3_600_000, // 6h
    totalMs: 3 * 3_600_000 + 90 * 60_000, // 4h30m
  },
  campaignsStats: { runs: 700, completions: 210, completionRate: 0.3 },
  achievements: { unlocked: 4200 },
  logins: { total: 10000, success: 9600, failed: 400, successRate: 0.96 },
  generatedAt: "2026-06-19T00:00:00.000Z",
};

const point = (date: string, n: number): AdminTimeseriesPoint => ({
  date,
  newUsers: n,
  activeUsers: n * 3,
  activeGuests: n,
  activeRegistered: n * 2,
  logins: n * 4,
  failedLogins: Math.floor(n / 2),
  onlineRounds: n * 2,
  soloRounds: n * 5,
  campaignRuns: n,
  games: n * 7,
  kills: n * 20,
  levelsCreated: 1,
});

const SERIES: AdminTimeseriesPoint[] = [
  point("Jun 01", 4),
  point("Jun 02", 9),
  point("Jun 03", 6),
];

describe("OverviewTab", () => {
  beforeEach(() => {
    useAdminOverview.mockReturnValue({ data: OVERVIEW, isLoading: false });
    useAdminTimeseries.mockReturnValue({ data: SERIES, isLoading: false });
    useAdminConnectedPlayers.mockReturnValue({
      data: {
        total: 2,
        registeredCount: 1,
        guestCount: 1,
        players: [],
      },
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
    });
  });

  it("renders headline KPI values from the overview DTO including Connected Now", () => {
    render(<OverviewTab />);
    expect(screen.getByText("Connected Now")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText(/4 reg · 3 guests/)).toBeTruthy();
    expect(screen.getByText("Total Players")).toBeTruthy();
    expect(screen.getByText("1284")).toBeTruthy();
    // accuracy is rendered as a whole-percent string
    expect(screen.getByText("45%")).toBeTruthy();
    // levels show published / total
    expect(screen.getByText("64 / 80")).toBeTruthy();
    // Active KPI includes guest hint
    expect(screen.getByText(/15 guests/)).toBeTruthy();
  });

  it("renders the connected players section", () => {
    render(<OverviewTab />);
    expect(screen.getByText("Connected Players")).toBeTruthy();
    expect(screen.getByText("2 Online")).toBeTruthy();
  });

  it("renders the bespoke SVG charts with the timeseries data", () => {
    const { container } = render(<OverviewTab />);
    expect(container.querySelector("svg")).toBeTruthy();
    // Activity line chart legend labels
    expect(screen.getByText("Games")).toBeTruthy();
    expect(screen.getByText("New Users")).toBeTruthy();
    expect(screen.getByText("Active Users")).toBeTruthy();
    // Daily Active Users chart and breakdown labels
    expect(screen.getByText("Daily Active Users")).toBeTruthy();
    expect(screen.getByText("Total Active")).toBeTruthy();
    expect(screen.getByText("Registered")).toBeTruthy();
    expect(screen.getByText("Guests")).toBeTruthy();
  });

  it("requests the default 30-day window", () => {
    render(<OverviewTab />);
    expect(useAdminTimeseries).toHaveBeenCalledWith("30d");
  });

  it("allows selecting the 24h window option", () => {
    render(<OverviewTab />);
    const btn24h = screen.getByRole("button", { name: "24h" });
    expect(btn24h).toBeTruthy();
    fireEvent.click(btn24h);
    expect(useAdminTimeseries).toHaveBeenCalledWith("24h");
    expect(screen.getByText("Last 24 hours")).toBeTruthy();
    expect(screen.getAllByText("Per hour").length).toBeGreaterThan(0);
  });

  it("shows a loading skeleton while the overview is fetching", () => {
    useAdminOverview.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<OverviewTab />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0
    );
  });
});
