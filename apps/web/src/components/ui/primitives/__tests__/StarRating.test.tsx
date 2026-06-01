import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { StarRating } from "../StarRating";

describe("StarRating", () => {
  it("renders `max` stars (default 5)", () => {
    const { container } = render(<StarRating value={0} />);
    expect(container.querySelectorAll("svg")).toHaveLength(5);
  });

  it("honours a custom max", () => {
    const { container } = render(<StarRating value={0} max={3} />);
    expect(container.querySelectorAll("svg")).toHaveLength(3);
  });

  it("fills exactly `value` stars", () => {
    const { container } = render(<StarRating value={3} />);
    expect(container.querySelectorAll('[class*="fill-yellow"]')).toHaveLength(
      3
    );
    expect(container.querySelectorAll('[class*="fill-none"]')).toHaveLength(2);
  });

  it("is read-only (no pointer affordance) without onRate", () => {
    const { container } = render(<StarRating value={2} />);
    const stars = container.querySelectorAll("span");
    expect(stars[0]!.className).not.toContain("cursor-pointer");
  });

  it("calls onRate with the 1-based star index when interactive", () => {
    const onRate = vi.fn();
    const { container } = render(<StarRating value={0} onRate={onRate} />);
    const stars = container.querySelectorAll("span");
    fireEvent.click(stars[3]!);
    expect(onRate).toHaveBeenCalledWith(4);
  });

  it("still fires onRate when disabled (so a logged-out user gets feedback)", () => {
    const onRate = vi.fn();
    const { container } = render(
      <StarRating value={0} onRate={onRate} disabled />
    );
    const stars = container.querySelectorAll("span");
    fireEvent.click(stars[0]!);
    expect(onRate).toHaveBeenCalledWith(1);
  });
});
