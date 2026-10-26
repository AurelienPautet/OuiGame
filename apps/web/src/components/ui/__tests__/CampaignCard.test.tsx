import { describe, it, expect, vi, beforeAll } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { CampaignCard } from "../CampaignCard";

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
describe("CampaignCard", () => {
  it("shows campaign title, author, and level count", () => {
    renderWithProviders(
      <CampaignCard
        campaignId={1}
        name="Desert Storm"
        author="General"
        levelCount={5}
      />
    );
    expect(screen.getByText("Desert Storm")).toBeTruthy();
    expect(screen.getByText(/General/)).toBeTruthy();
  });

  it("renders star rating and count when rating > 0", () => {
    const { container } = renderWithProviders(
      <CampaignCard
        campaignId={1}
        name="Rated Campaign"
        rating={4.2}
        ratingCount={18}
      />
    );
    expect(screen.getByText("4.2")).toBeTruthy();
    expect(screen.getByText("(18)")).toBeTruthy();
    // Has star SVG icons
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("shows unrated state when rating is 0", () => {
    renderWithProviders(
      <CampaignCard campaignId={1} name="Fresh Campaign" rating={0} />
    );
    expect(screen.getByText(/unrated/i)).toBeTruthy();
  });

  it("renders difficulty badges for various difficulty levels", () => {
    const { rerender } = renderWithProviders(
      <CampaignCard campaignId={1} name="Training Camp" difficulty="easy" />
    );
    expect(screen.getByText("Easy")).toBeTruthy();

    rerender(
      <CampaignCard campaignId={1} name="Nightmare Citadel" difficulty="hard" />
    );
    expect(screen.getByText("Hard")).toBeTruthy();
  });

  it("shows bot count and run stats when available", () => {
    renderWithProviders(
      <CampaignCard
        campaignId={1}
        name="Warzone"
        timesPlayed={40}
        clearRate={65}
      />
    );
    expect(screen.getByText(/40 plays/i)).toBeTruthy();
    expect(screen.getByText(/65% clear/i)).toBeTruthy();
  });

  it("shows completed badge when campaign is beaten", () => {
    renderWithProviders(
      <CampaignCard
        campaignId={1}
        name="Mastery"
        completed={true}
        completionPercent={100}
      />
    );
    expect(screen.getByText(/done/i)).toBeTruthy();
  });

  it("fires onPlay, onEdit, onDelete actions when present", () => {
    const onPlay = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    renderWithProviders(
      <CampaignCard
        campaignId={42}
        name="My Custom Campaign"
        onPlay={onPlay}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    const playBtn = screen.getByRole("button", { name: /play/i });
    const editBtn = screen.getByRole("button", { name: /edit/i });
    const deleteBtn = screen.getByRole("button", { name: /delete/i });

    fireEvent.click(playBtn);
    expect(onPlay).toHaveBeenCalledWith(42);

    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(42);

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(42);
  });
});

it("supports keyboard selection and does not invent difficulty for missing data", () => {
  const select = vi.fn();
  renderWithProviders(
    <CampaignCard campaignId={1} name="Accessible campaign" onClick={select} />
  );
  const card = screen.getByRole("button", { name: "Accessible campaign" });
  fireEvent.keyDown(card, { key: "Enter" });
  fireEvent.keyDown(card, { key: " " });
  expect(select).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Not enough runs")).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
});
