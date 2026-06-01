import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button";

describe("Button", () => {
  it("renders its children as the accessible label", () => {
    render(<Button>Play</Button>);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("defaults to type=button (so it never submits a surrounding form)", () => {
    render(<Button>X</Button>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });

  it("honours an explicit type", () => {
    render(<Button type="submit">X</Button>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
  });

  it("fires onClick when pressed", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the variant and size classes", () => {
    render(
      <Button variant="green" size="lg">
        G
      </Button>
    );
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("bg-green");
    expect(cls).toContain("text-lg");
  });

  it("merges a custom className", () => {
    render(<Button className="my-extra">C</Button>);
    expect(screen.getByRole("button").className).toContain("my-extra");
  });

  it("is disabled and swallows clicks when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        No
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn.hasAttribute("disabled")).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
