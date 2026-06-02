import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { LevelCard } from "../LevelCard";

describe("LevelCard", () => {
  it("shows the level name, thumbnail alt and author", () => {
    renderWithProviders(
      <LevelCard levelId={7} levelName="Arena" author="Alice" />
    );
    expect(screen.getByText(/Arena/)).toBeTruthy();
    expect(screen.getByAltText("Level 7 preview")).toBeTruthy();
    expect(screen.getByText(/Alice/)).toBeTruthy();
  });

  it("renders a 5-star rating from the (string) rating aggregate", () => {
    const { container } = renderWithProviders(
      <LevelCard levelId={1} levelName="L" rating="4" />
    );
    expect(container.querySelectorAll("svg")).toHaveLength(5);
    expect(container.querySelectorAll('[class*="fill-yellow"]')).toHaveLength(
      4
    );
  });

  it("fires onClick when not locked", () => {
    const onClick = vi.fn();
    const { container } = renderWithProviders(
      <LevelCard levelId={1} levelName="L" onClick={onClick} />
    );
    fireEvent.click(container.firstChild as Element);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when locked", () => {
    const onClick = vi.fn();
    const { container } = renderWithProviders(
      <LevelCard levelId={1} levelName="L" onClick={onClick} locked />
    );
    fireEvent.click(container.firstChild as Element);
    expect(onClick).not.toHaveBeenCalled();
  });
});
