import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";

// useSocket is mocked so the toast-logic tests don't need a real SocketProvider;
// it's reconfigured per test (null for pure logic, a fake socket for the
// game-event branch).
vi.mock("../SocketContext", () => ({ useSocket: vi.fn() }));

import { useSocket } from "../SocketContext";
import { ToastProvider, useToast, TOAST_TYPES } from "../ToastContext";

const mockUseSocket = useSocket as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  mockUseSocket.mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const render = () => renderHook(() => useToast(), { wrapper: ToastProvider });

describe("toast lifecycle", () => {
  it("adds a toast, marks it exiting after the duration, then removes it", () => {
    const { result } = render();
    act(() => {
      result.current.addToast(TOAST_TYPES.INFO, "Title", "msg");
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.toasts[0]!.exiting).toBe(true);

    act(() => vi.advanceTimersByTime(500));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("removeToast removes immediately", () => {
    const { result } = render();
    let id = 0;
    act(() => {
      id = result.current.addToast(TOAST_TYPES.INFO, "T", "m");
    });
    act(() => result.current.removeToast(id));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("throws when used outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(
      /must be used within ToastProvider/
    );
  });
});

describe("socket game-event toasts", () => {
  it("formats player-kill messages by type and unsubscribes on unmount", () => {
    const handlers: Record<string, (...a: unknown[]) => void> = {};
    const fakeSocket = {
      on: vi.fn((e: string, h: (...a: unknown[]) => void) => {
        handlers[e] = h;
      }),
      off: vi.fn(),
    };
    mockUseSocket.mockReturnValue({ socket: fakeSocket });

    const { result, unmount } = render();

    act(() =>
      handlers["player-kill"]!({ players: ["A", "B"], type: "bullet" })
    );
    expect(result.current.toasts[0]!.text).toBe("A killed B");

    act(() => handlers["player-kill"]!({ players: ["C", "D"], type: "mine" }));
    expect(result.current.toasts.some((t) => t.text === "C blew up D")).toBe(
      true
    );

    unmount();
    expect(fakeSocket.off).toHaveBeenCalledWith(
      "player-kill",
      expect.any(Function)
    );
  });
});
