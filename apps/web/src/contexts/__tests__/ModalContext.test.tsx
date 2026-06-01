import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { ModalProvider, useModal, MODALS } from "../ModalContext";

afterEach(() => cleanup());

const render = () => renderHook(() => useModal(), { wrapper: ModalProvider });

describe("ModalContext", () => {
  it("opens and closes modals and reports which is open", () => {
    const { result } = render();
    expect(result.current.activeModal).toBeNull();
    expect(result.current.modalData).toBeNull();

    act(() => result.current.openModal(MODALS.AUTH, { from: "x" }));
    expect(result.current.activeModal).toBe(MODALS.AUTH);
    expect(result.current.modalData).toEqual({ from: "x" });
    expect(result.current.isOpen(MODALS.AUTH)).toBe(true);
    expect(result.current.isOpen(MODALS.PROFILE)).toBe(false);

    act(() => result.current.closeModal());
    expect(result.current.activeModal).toBeNull();
    expect(result.current.modalData).toBeNull();
  });

  it("throws when used outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useModal())).toThrow(
      /must be used within ModalProvider/
    );
  });
});
