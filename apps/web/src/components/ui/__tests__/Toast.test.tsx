import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "../Toast";
import { TOAST_TYPES } from "../../../contexts/ToastContext";

describe("Toast", () => {
  it("renders the title and text inside an alert region", () => {
    render(<Toast type={TOAST_TYPES.INFO} title="Heads up" text="Something" />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    expect(screen.getByText("Heads up")).toBeTruthy();
    expect(screen.getByText("Something")).toBeTruthy();
  });

  it("colours by type (error → red, connection → green)", () => {
    const { rerender } = render(
      <Toast type={TOAST_TYPES.ERROR} title="t" text="x" />
    );
    expect(screen.getByRole("alert").className).toContain("bg-red");

    rerender(<Toast type={TOAST_TYPES.CONNECTION} title="t" text="x" />);
    expect(screen.getByRole("alert").className).toContain("bg-green");
  });

  it("falls back to the info colour for an unknown type", () => {
    render(<Toast type="totally-unknown" title="t" text="x" />);
    expect(screen.getByRole("alert").className).toContain("bg-blue");
  });
});
