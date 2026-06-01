import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";

// closeModal must exist before vi.mock's hoisted factory runs.
const { closeModal } = vi.hoisted(() => ({ closeModal: vi.fn() }));

// Replace only useModal; keep the real ModalProvider so renderWithProviders works.
vi.mock("../../../contexts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../contexts")>();
  return {
    ...actual,
    useModal: () => ({
      closeModal,
      openModal: vi.fn(),
      activeModal: null,
      modalData: null,
      isOpen: () => false,
    }),
  };
});

import { renderWithProviders } from "../../../test/renderWithProviders";
import { TankSelectModal } from "../TankSelectModal";
import { storage } from "../../../lib/storage";
import { TANK_COLORS } from "../../../constants/tankColors";

describe("TankSelectModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    closeModal.mockClear();
  });

  it("renders a dialog with a body and a turret swatch row", () => {
    renderWithProviders(<TankSelectModal />);
    // Radix renders the dialog into a portal, so scope queries to the dialog.
    const dialog = screen.getByRole("dialog");
    // One pressable swatch per colour, in each of the two rows.
    expect(dialog.querySelectorAll("button[aria-pressed]")).toHaveLength(
      TANK_COLORS.length * 2
    );
  });

  it("persists the chosen colours and requests close on save", () => {
    const setSpy = vi
      .spyOn(storage, "setTankColors")
      .mockImplementation(() => {});
    renderWithProviders(<TankSelectModal />);

    // Body swatches come first; pick index 2 (default selection is index 1).
    const swatches = screen
      .getByRole("dialog")
      .querySelectorAll("button[aria-pressed]");
    fireEvent.click(swatches[2]!);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(setSpy).toHaveBeenCalledWith(2, 1, TANK_COLORS[2], TANK_COLORS[1]);
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it("closes without persisting on cancel", () => {
    const setSpy = vi
      .spyOn(storage, "setTankColors")
      .mockImplementation(() => {});
    renderWithProviders(<TankSelectModal />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(setSpy).not.toHaveBeenCalled();
  });
});
