import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type {
  AdminLevelsResponse,
  AdminCampaignsResponse,
} from "@ouigame/shared/api";

// Mutation spies are hoisted so the vi.mock factory and the assertions share
// the exact same fn instances.
const updateLevel = vi.fn();
const deleteLevel = vi.fn();
const deleteCampaign = vi.fn();

const levelsResponse: AdminLevelsResponse = {
  levels: [
    {
      id: 1,
      name: "Sniper Alley",
      type: "ffa",
      status: "up",
      maxPlayers: 8,
      creatorName: "ada",
      createdAt: "2026-01-02T00:00:00.000Z",
      plays: 142,
      rating: 4.5,
      ratingCount: 30,
    },
    {
      id: 2,
      name: "Hidden Bunker",
      type: "ctf",
      status: "down",
      maxPlayers: 4,
      creatorName: null,
      createdAt: "2026-01-03T00:00:00.000Z",
      plays: 7,
      rating: null,
      ratingCount: 0,
    },
  ],
  total: 2,
  page: 1,
  pageSize: 25,
};

const campaignsResponse: AdminCampaignsResponse = {
  campaigns: [
    {
      id: 11,
      name: "Boot Camp",
      creatorName: "grace",
      createdAt: "2026-01-05T00:00:00.000Z",
      levelCount: 6,
      runs: 88,
      completions: 21,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
};

vi.mock("../../../hooks/api", () => ({
  useAdminLevels: () => ({
    data: levelsResponse,
    isLoading: false,
    isError: false,
  }),
  useAdminCampaigns: () => ({
    data: campaignsResponse,
    isLoading: false,
    isError: false,
  }),
  useUpdateAdminLevel: () => ({ mutate: updateLevel, isPending: false }),
  useDeleteAdminLevel: () => ({ mutate: deleteLevel, isPending: false }),
  useDeleteAdminCampaign: () => ({ mutate: deleteCampaign, isPending: false }),
}));

import { ContentTab } from "../ContentTab";

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("ContentTab", () => {
  it("renders a level row from the contract", () => {
    render(<ContentTab />);
    expect(screen.getByText("Sniper Alley")).toBeTruthy();
    expect(screen.getByText("ada")).toBeTruthy();
    // rating shows the value + count
    expect(screen.getByText("4.5")).toBeTruthy();
  });

  it("toggles a level's status via the update mutation", () => {
    render(<ContentTab />);
    // The "up" level offers a take-down action.
    fireEvent.click(screen.getByRole("button", { name: "Take level down" }));
    expect(updateLevel).toHaveBeenCalledTimes(1);
    expect(updateLevel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, status: "down" })
    );
  });

  it("publishes a down level via the update mutation", () => {
    render(<ContentTab />);
    fireEvent.click(screen.getByRole("button", { name: "Publish level" }));
    expect(updateLevel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 2, status: "up" })
    );
  });

  it("confirms before deleting a level and calls the delete mutation", () => {
    render(<ContentTab />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete level" })[0]!
    );
    // confirm dialog appears with the level name
    expect(screen.getByText("Delete level?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteLevel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      expect.anything()
    );
  });

  it("switches to campaigns and deletes one", () => {
    render(<ContentTab />);
    fireEvent.click(screen.getByRole("button", { name: "Campaigns" }));
    expect(screen.getByText("Boot Camp")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete campaign" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ id: 11 }),
      expect.anything()
    );
  });
});
