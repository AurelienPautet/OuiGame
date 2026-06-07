import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { SettingsProvider } from "../../../contexts";
import { PauseOverlay } from "../PauseOverlay";
import { storage } from "../../../lib/storage";
import { DEFAULT_SETTINGS, KEY_PRESETS } from "../../../lib/settings";
import type { Settings } from "../../../lib/settings";

// Seed a settings blob into localStorage so SettingsProvider's loadSettings()
// picks it up on mount, then render the overlay inside the real provider.
// getByText throws when a match is missing, so each call is itself an assertion.
const renderPause = (
  overrides: Partial<Settings> = {},
  props: Partial<Parameters<typeof PauseOverlay>[0]> = {}
) => {
  storage.setSettings({ ...DEFAULT_SETTINGS, ...overrides });
  const noop = vi.fn();
  return renderWithProviders(
    <SettingsProvider>
      <PauseOverlay
        onResume={props.onResume ?? noop}
        onQuit={props.onQuit ?? noop}
        onSettings={props.onSettings ?? noop}
        onRetry={props.onRetry}
      />
    </SettingsProvider>
  );
};

describe("PauseOverlay controls reference", () => {
  it("explains the default keyboard + mouse controls", () => {
    renderPause();
    expect(screen.getByText("Controls")).toBeTruthy();
    // Default WASD movement caps.
    ["W", "A", "S", "D"].forEach((k) =>
      expect(screen.getByText(k)).toBeTruthy()
    );
    // Mouse aims, click fires, Esc pauses.
    expect(screen.getByText("Mouse")).toBeTruthy();
    expect(screen.getByText("Click")).toBeTruthy();
    expect(screen.getByText("Esc")).toBeTruthy();
  });

  it("mirrors rebound movement keys", () => {
    renderPause({ keybindings: KEY_PRESETS.Arrows });
    ["↑", "←", "↓", "→"].forEach((k) =>
      expect(screen.getByText(k)).toBeTruthy()
    );
    // The letter caps are gone once arrows are bound.
    expect(screen.queryByText("W")).toBeNull();
  });

  it("describes the on-screen sticks when touch controls are forced on", () => {
    renderPause({ touchControls: "on", autoFire: true });
    expect(screen.getByText("Left stick")).toBeTruthy();
    expect(screen.getByText("Right stick")).toBeTruthy();
    expect(screen.getByText("Hold to aim")).toBeTruthy();
    // No keyboard/mouse caps in the touch layout.
    expect(screen.queryByText("Mouse")).toBeNull();
  });

  it("shows a dedicated fire button when touch auto-fire is off", () => {
    renderPause({ touchControls: "on", autoFire: false });
    expect(screen.getByText("Fire button")).toBeTruthy();
    expect(screen.queryByText("Hold to aim")).toBeNull();
  });
});
