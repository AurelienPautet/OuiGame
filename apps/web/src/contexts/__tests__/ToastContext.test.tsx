import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ReactNode } from "react";
import { act, renderHook, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// useSocket is mocked so the toast-logic tests don't need a real SocketProvider;
// it's reconfigured per test (null for pure logic, a fake socket for the
// game-event branch).
vi.mock("../SocketContext", () => ({ useSocket: vi.fn() }));

import { useSocket } from "../SocketContext";
import { ToastProvider, useToast, TOAST_TYPES } from "../ToastContext";

const mockUseSocket = useSocket as ReturnType<typeof vi.fn>;

// ToastProvider reads useQueryClient() (to refresh achievements on unlock), so it
// must mount under a QueryClientProvider.
const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <ToastProvider>{children}</ToastProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  vi.useFakeTimers();
  mockUseSocket.mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

const render = () => renderHook(() => useToast(), { wrapper: Wrapper });

describe("toast lifecycle", () => {
  it("adds a toast, then drops it from state after the duration", () => {
    const { result } = render();
    act(() => {
      result.current.addToast(TOAST_TYPES.INFO, "Title", "msg");
    });
    expect(result.current.toasts).toHaveLength(1);

    // After the full duration the toast is removed from state directly;
    // AnimatePresence plays the slide-out exit as the element unmounts, so
    // there is no separate in-state "exiting" phase anymore.
    act(() => vi.advanceTimersByTime(1500));
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
