import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TankAvatar } from "../TankAvatar";

describe("TankAvatar", () => {
  it("renders a labelled canvas", () => {
    render(<TankAvatar bodyColor="blue" />);
    const img = screen.getByRole("img");
    expect(img.tagName).toBe("CANVAS");
    expect(img.getAttribute("aria-label")).toBe("tank");
  });

  it("uses the provided title as the accessible label", () => {
    render(<TankAvatar bodyColor="green" title="Green tank" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Green tank"
    );
  });

  it("sizes the canvas from the size prop", () => {
    render(<TankAvatar bodyColor="red" size={64} />);
    const canvas = screen.getByRole("img") as HTMLCanvasElement;
    expect(canvas.getAttribute("width")).toBe("64");
    expect(canvas.getAttribute("height")).toBe("64");
  });
});
