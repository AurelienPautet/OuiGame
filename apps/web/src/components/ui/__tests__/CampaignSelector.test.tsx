import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { CampaignSelector } from "../CampaignSelector";
import type { CampaignDTO } from "@ouigame/shared/api";

const mockCampaigns: CampaignDTO[] = [
  {
    campaign_id: 1,
    campaign_name: "Alpha Assault",
    campaign_description: "First battle for recruits",
    campaign_creator_name: "Commander",
    level_count: 3,
    completion_percent: 100,
    completed: true,
    rating: 4.8,
    rating_count: 25,
    difficulty: "easy",
    difficulty_score: 2,
    times_played: 150,
    clear_rate: 85,
    enemy_count: 8,
  },
  {
    campaign_id: 2,
    campaign_name: "Bravo Blitz",
    campaign_description: "Stealth and speed required",
    campaign_creator_name: "Ghost",
    level_count: 7,
    completion_percent: 40,
    completed: false,
    rating: 3.5,
    rating_count: 10,
    difficulty: "hard",
    difficulty_score: 8,
    times_played: 70,
    clear_rate: 30,
    enemy_count: 35,
  },
  {
    campaign_id: 3,
    campaign_name: "Charlie Chaos",
    campaign_description: "Minefields everywhere",
    campaign_creator_name: "Demolition",
    level_count: 5,
    completion_percent: 0,
    completed: false,
    rating: 4.2,
    rating_count: 14,
    difficulty: "medium",
    difficulty_score: 5,
    times_played: 45,
    clear_rate: 55,
    enemy_count: 18,
  },
];

let queryData = mockCampaigns;
let queryLoading = false;

vi.mock("../../../hooks/api", () => ({
  useCampaigns: () => ({ data: queryData, isLoading: queryLoading }),
  useMyCampaigns: () => ({ data: queryData, isLoading: queryLoading }),
}));

describe("CampaignSelector", () => {
  beforeEach(() => {
    queryData = mockCampaigns;
    queryLoading = false;
    window.localStorage.clear();
  });

  it("renders the list of campaigns with all cards", () => {
    renderWithProviders(<CampaignSelector mode="play" />);
    expect(screen.getByText("Alpha Assault")).toBeTruthy();
    expect(screen.getByText("Bravo Blitz")).toBeTruthy();
    expect(screen.getByText("Charlie Chaos")).toBeTruthy();
  });

  it("filters campaigns by search name", () => {
    renderWithProviders(<CampaignSelector mode="play" />);
    const searchInput = screen.getByPlaceholderText(/search campaign name/i);
    fireEvent.change(searchInput, { target: { value: "Bravo" } });

    expect(screen.queryByText("Alpha Assault")).toBeNull();
    expect(screen.getByText("Bravo Blitz")).toBeTruthy();
    expect(screen.queryByText("Charlie Chaos")).toBeNull();
  });

  it("filters campaigns by difficulty", async () => {
    renderWithProviders(<CampaignSelector mode="play" />);

    // Target the select with aria-label "Difficulty"
    const diffSelect = screen.getByLabelText(/difficulty/i);
    fireEvent.click(diffSelect);

    // Pick "Easy"
    const easyOption = await screen.findByText(/🟢 Easy/i);
    fireEvent.click(easyOption);

    // Only Alpha Assault is easy
    expect(screen.getByText("Alpha Assault")).toBeTruthy();
    expect(screen.queryByText("Bravo Blitz")).toBeNull();
    expect(screen.queryByText("Charlie Chaos")).toBeNull();
  });

  it("filters campaigns by status (e.g. completed)", async () => {
    renderWithProviders(<CampaignSelector mode="play" />);

    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.click(statusSelect);

    const completedOption = await screen.findByText(/🏆 Completed/i);
    fireEvent.click(completedOption);

    // Only Alpha Assault is completed
    expect(screen.getByText("Alpha Assault")).toBeTruthy();
    expect(screen.queryByText("Bravo Blitz")).toBeNull();
    expect(screen.queryByText("Charlie Chaos")).toBeNull();
  });

  it("shows empty state and allows resetting filters", async () => {
    renderWithProviders(<CampaignSelector mode="play" />);

    const searchInput = screen.getByPlaceholderText(/search campaign name/i);
    fireEvent.change(searchInput, { target: { value: "NonExistentCampaign" } });

    expect(
      screen.getByText(/no campaigns match the selected filters/i)
    ).toBeTruthy();

    const resetBtn = screen.getByRole("button", { name: /reset filters/i });
    fireEvent.click(resetBtn);

    // After reset, all campaigns are shown again
    expect(screen.getByText("Alpha Assault")).toBeTruthy();
    expect(screen.getByText("Bravo Blitz")).toBeTruthy();
    expect(screen.getByText("Charlie Chaos")).toBeTruthy();
  });

  it("fires onSelect when a card is clicked in play mode", () => {
    const onSelect = vi.fn();
    renderWithProviders(<CampaignSelector mode="play" onSelect={onSelect} />);

    fireEvent.click(screen.getByText("Alpha Assault"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("renders new campaign button in my mode and triggers onCreate", () => {
    const onCreate = vi.fn();
    renderWithProviders(<CampaignSelector mode="my" onCreate={onCreate} />);

    const newBtn = screen.getByRole("button", { name: /new campaign/i });
    fireEvent.click(newBtn);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
