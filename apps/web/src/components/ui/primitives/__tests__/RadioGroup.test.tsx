import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RadioGroup } from "../RadioGroup";

const OPTIONS = ["red", "green", "blue"] as const;

describe("RadioGroup", () => {
  it("renders a radiogroup with one radio per option", () => {
    render(
      <RadioGroup
        aria-label="Colour"
        value="red"
        options={OPTIONS}
        onValueChange={() => {}}
      />
    );
    expect(screen.getByRole("radiogroup", { name: "Colour" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(OPTIONS.length);
  });

  it("marks the selected option with aria-checked and makes it the tab stop", () => {
    render(
      <RadioGroup
        aria-label="Colour"
        value="green"
        options={OPTIONS}
        onValueChange={() => {}}
      />
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    // Roving tabindex: only the selected radio is tabbable.
    expect(radios.map((r) => r.getAttribute("tabindex"))).toEqual([
      "-1",
      "0",
      "-1",
    ]);
  });

  it("calls onValueChange with the clicked option", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        aria-label="Colour"
        value="red"
        options={OPTIONS}
        onValueChange={onValueChange}
      />
    );
    fireEvent.click(screen.getAllByRole("radio")[2]!);
    expect(onValueChange).toHaveBeenCalledWith("blue");
  });

  it("moves selection with arrow keys, wrapping at the ends", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        aria-label="Colour"
        value="red"
        options={OPTIONS}
        onValueChange={onValueChange}
      />
    );
    const radios = screen.getAllByRole("radio");
    fireEvent.keyDown(radios[0]!, { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenLastCalledWith("green");
    // Wrap backwards from the first option to the last.
    fireEvent.keyDown(radios[0]!, { key: "ArrowLeft" });
    expect(onValueChange).toHaveBeenLastCalledWith("blue");
  });

  it("uses optionLabel for the accessible name and renders children content", () => {
    render(
      <RadioGroup
        aria-label="Colour"
        value="red"
        options={OPTIONS}
        onValueChange={() => {}}
        optionLabel={(v) => `Colour ${v}`}
      >
        {(v) => <span>{v.toUpperCase()}</span>}
      </RadioGroup>
    );
    expect(screen.getByRole("radio", { name: "Colour blue" })).toBeTruthy();
    expect(screen.getByText("BLUE")).toBeTruthy();
  });
});
