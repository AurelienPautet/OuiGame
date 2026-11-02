import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
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
    times_played: 150,
    clear_rate: 85,
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
    times_played: 70,
    clear_rate: 30,
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
    times_played: 45,
    clear_rate: 55,
  },
];

let queryData = mockCampaigns;
let queryLoading = false;
let queryError = false;
const refetch = vi.fn();
const queryCalls = vi.hoisted(() => ({ public: vi.fn(), my: vi.fn() }));

vi.mock("../../../hooks/api", () => ({
  useCampaigns: (...args: unknown[]) => {
    queryCalls.public(...args);
    return {
      data: queryData,
      isLoading: queryLoading,
      isError: queryError,
      refetch,
    };
  },
  useMyCampaigns: (...args: unknown[]) => {
    queryCalls.my(...args);
    return {
      data: queryData,
      isLoading: queryLoading,
      isError: queryError,
      refetch,
    };
  },
}));

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

describe("CampaignSelector", () => {
  beforeEach(() => {
    queryData = mockCampaigns;
    queryLoading = false;
    queryError = false;
    vi.clearAllMocks();
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
    const searchInput = screen.getByPlaceholderText(
      /search campaigns or creators/i
    );
    fireEvent.change(searchInput, { target: { value: "Bravo" } });

    expect(screen.queryByText("Alpha Assault")).toBeNull();
    expect(screen.getByText("Bravo Blitz")).toBeTruthy();
    expect(screen.queryByText("Charlie Chaos")).toBeNull();
  });

  it("filters campaigns by difficulty", async () => {
    renderWithProviders(<CampaignSelector mode="play" />);

    fireEvent.click(screen.getByRole("button", { name: /^easy$/i }));

    // Only Alpha Assault is easy
    expect(screen.getByText("Alpha Assault")).toBeTruthy();
    expect(screen.queryByText("Bravo Blitz")).toBeNull();
    expect(screen.queryByText("Charlie Chaos")).toBeNull();
  });

  it("keeps only search and difficulty, with no status/rating/sort bar", () => {
    renderWithProviders(<CampaignSelector mode="play" />);

    expect(
      screen.getByPlaceholderText(/search campaigns or creators/i)
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /all difficulties/i })
    ).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/^showing /i)).toBeNull();
  });

  it("lists campaigns newest first", () => {
    renderWithProviders(<CampaignSelector mode="play" />);

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((x) => x.textContent)
    ).toEqual(["Charlie Chaos", "Bravo Blitz", "Alpha Assault"]);
  });

  it("shows empty state and allows resetting filters", async () => {
    renderWithProviders(<CampaignSelector mode="play" />);

    const searchInput = screen.getByPlaceholderText(
      /search campaigns or creators/i
    );
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

describe("campaign discovery regressions", () => {
  beforeEach(() => {
    queryData = mockCampaigns;
    queryLoading = false;
    queryError = false;
    vi.clearAllMocks();
  });
  it("searches authors and descriptions without narrowing the API query", () => {
    renderWithProviders(<CampaignSelector />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: " Ghost " } });
    expect(screen.getByText("Bravo Blitz")).toBeTruthy();
    expect(screen.queryByText("Alpha Assault")).toBeNull();
    fireEvent.change(input, { target: { value: "Minefields" } });
    expect(screen.getByText("Charlie Chaos")).toBeTruthy();
    expect(queryCalls.public).toHaveBeenLastCalledWith({}, true);
    expect(queryCalls.my).toHaveBeenLastCalledWith({}, false);
  });
  it("combines search and difficulty, then resets them", () => {
    renderWithProviders(<CampaignSelector />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Chaos" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Easy" }));
    expect(screen.getByText(/no campaigns match/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /reset filters/i }));
    expect(screen.getByText("Alpha Assault")).toBeTruthy();
    expect(screen.getByText("Bravo Blitz")).toBeTruthy();
    expect(screen.getByText("Charlie Chaos")).toBeTruthy();
  });
  it("keeps unknown difficulty out of the named difficulty chips", () => {
    queryData = [
      ...mockCampaigns,
      {
        ...mockCampaigns[0]!,
        campaign_id: 4,
        campaign_name: "Unknown campaign",
        difficulty: "unknown",
        rating: 0,
        rating_count: 0,
      },
    ];
    renderWithProviders(<CampaignSelector />);
    fireEvent.click(screen.getByRole("button", { name: /not enough runs/i }));
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(screen.getByText("Unknown campaign")).toBeTruthy();
  });
  it("uses only the owner query in my mode", () => {
    renderWithProviders(<CampaignSelector mode="my" />);
    expect(queryCalls.public).toHaveBeenLastCalledWith({}, false);
    expect(queryCalls.my).toHaveBeenLastCalledWith({}, true);
  });
  it("shows a retryable error rather than claiming there are no campaigns", () => {
    queryError = true;
    renderWithProviders(<CampaignSelector />);
    expect(screen.getByText(/could not load/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
  it("starts fresh when reopened, without hiding results behind saved filters", () => {
    const { unmount } = renderWithProviders(<CampaignSelector />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "no match" },
    });
    unmount();
    renderWithProviders(<CampaignSelector />);
    expect(screen.getByRole("textbox").getAttribute("value")).toBe("");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);
  });
});
