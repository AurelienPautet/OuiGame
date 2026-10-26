import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LineChart, BarChart } from "../index";

const SERIES_DATA = [
  { date: "Jun 01", players: 4, games: 2 },
  { date: "Jun 02", players: 9, games: 5 },
  { date: "Jun 03", players: 6, games: 7 },
];

const BAR_DATA = [
  { name: "Solo", plays: 12 },
  { name: "Online", plays: 30 },
  { name: "Campaign", plays: 7 },
];

describe("LineChart", () => {
  it("renders an <svg> and the series legend labels", () => {
    const { container } = render(
      <LineChart
        data={SERIES_DATA}
        xKey="date"
        series={[
          { key: "players", label: "New Players", color: "#00b2e1" },
          { key: "games", label: "Games", color: "#00e06a" },
        ]}
        area
      />
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("New Players")).toBeTruthy();
    expect(screen.getByText("Games")).toBeTruthy();
  });

  it("renders chart paths and allows toggling series via legend", () => {
    const { container } = render(
      <LineChart
        data={SERIES_DATA}
        xKey="date"
        series={[
          { key: "players", label: "New Players", color: "#00b2e1" },
          { key: "games", label: "Games", color: "#00e06a" },
        ]}
      />
    );
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);

    const toggleBtn = screen.getByText("New Players").closest("button");
    expect(toggleBtn).toBeTruthy();
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      expect(toggleBtn.className).toContain("opacity-35");
    }
  });

  it("renders an empty state with no data", () => {
    const { container } = render(
      <LineChart
        data={[]}
        xKey="date"
        series={[{ key: "players", label: "New Players", color: "#00b2e1" }]}
      />
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText("No data yet")).toBeTruthy();
  });
});

describe("BarChart", () => {
  it("renders an <svg> and bar elements", () => {
    const { container } = render(
      <BarChart data={BAR_DATA} xKey="name" barKey="plays" color="#ffb142" />
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("renders x-axis data categories", () => {
    const { container } = render(
      <BarChart data={BAR_DATA} xKey="name" barKey="plays" color="#ffb142" />
    );
    expect(container.querySelector("svg")).toBeTruthy();
    // ECharts SVG renderer produces text elements for axis labels
    const textContents = Array.from(container.querySelectorAll("text")).map(
      (t) => t.textContent
    );
    expect(textContents.some((t) => t?.includes("Solo"))).toBe(true);
    expect(textContents.some((t) => t?.includes("Campaign"))).toBe(true);
  });

  it("renders an empty state with no data", () => {
    const { container } = render(
      <BarChart data={[]} xKey="name" barKey="plays" color="#ffb142" />
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText("No data yet")).toBeTruthy();
  });
});
