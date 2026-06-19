import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("renders one polyline per series", () => {
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
    expect(container.querySelectorAll("polyline").length).toBe(2);
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
  it("renders an <svg> with one bar per data row", () => {
    const { container } = render(
      <BarChart data={BAR_DATA} xKey="name" barKey="plays" color="#ffb142" />
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelectorAll("rect").length).toBe(BAR_DATA.length);
  });

  it("renders a sparse x-axis label from the data", () => {
    render(
      <BarChart data={BAR_DATA} xKey="name" barKey="plays" color="#ffb142" />
    );
    // first + last ticks are always shown
    expect(screen.getByText("Solo")).toBeTruthy();
    expect(screen.getByText("Campaign")).toBeTruthy();
  });

  it("renders an empty state with no data", () => {
    const { container } = render(
      <BarChart data={[]} xKey="name" barKey="plays" color="#ffb142" />
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByText("No data yet")).toBeTruthy();
  });
});
