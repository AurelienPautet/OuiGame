import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

describe("StatCard", () => {
  it("renders the label and value", () => {
    render(<StatCard label="Total Players" value={1284} />);
    expect(screen.getByText("Total Players")).toBeTruthy();
    expect(screen.getByText("1284")).toBeTruthy();
  });

  it("renders a string value and an optional hint", () => {
    render(<StatCard label="Accuracy" value="64%" hint="hits / shots" />);
    expect(screen.getByText("64%")).toBeTruthy();
    expect(screen.getByText("hits / shots")).toBeTruthy();
  });

  it("applies the tone class to the icon chip", () => {
    const { container } = render(
      <StatCard
        label="Kills"
        value={42}
        tone="red"
        icon={<span data-testid="icon">x</span>}
      />
    );
    expect(screen.getByTestId("icon")).toBeTruthy();
    // the icon chip carries the tone fill utility
    expect(container.querySelector(".bg-red")).toBeTruthy();
  });

  it("defaults the tone to blue when an icon is given", () => {
    const { container } = render(
      <StatCard label="Games" value={9} icon={<span>g</span>} />
    );
    expect(container.querySelector(".bg-blue")).toBeTruthy();
  });

  it("renders no icon chip when no icon is provided", () => {
    const { container } = render(<StatCard label="Logins" value={5} />);
    expect(container.querySelector("[aria-hidden='true']")).toBeNull();
  });
});
