import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";

vi.mock("socket.io-client", () => {
  const socket = {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return { io: vi.fn(() => socket) };
});
vi.mock("../../api/authEvents", () => ({ onAuthChange: vi.fn(() => vi.fn()) }));
vi.mock("../../lib/storage", () => ({
  storage: {
    getSessionId: vi.fn(),
    getClientId: vi.fn(() => "mock-client-id"),
    getPlayerName: vi.fn(() => "mock-player-name"),
  },
}));

import { io } from "socket.io-client";
import { onAuthChange } from "../../api/authEvents";
import { storage } from "../../lib/storage";
import { SocketProvider, useSocket } from "../SocketContext";

const ioMock = io as unknown as ReturnType<typeof vi.fn>;
const onAuthChangeMock = onAuthChange as ReturnType<typeof vi.fn>;
const getSessionId = storage.getSessionId as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const render = () => renderHook(() => useSocket(), { wrapper: SocketProvider });
const handlerFor = (sock: any, ev: string) =>
  sock.on.mock.calls.find((c: unknown[]) => c[0] === ev)?.[1];

describe("SocketContext", () => {
  it("creates one socket and supplies the token via the auth callback", () => {
    getSessionId.mockReturnValue("tok");
    render();
    expect(ioMock).toHaveBeenCalledTimes(1);

    const opts = ioMock.mock.calls[0]![1];
    const cb = vi.fn();
    opts.auth(cb);
    expect(cb).toHaveBeenCalledWith({
      token: "tok",
      clientId: "mock-client-id",
      playerName: "mock-player-name",
    });
  });

  it("tracks connect/disconnect/online_count", () => {
    const { result } = render();
    const sock = ioMock.mock.results[0]!.value;

    act(() => handlerFor(sock, "connect")());
    expect(result.current.isConnected).toBe(true);
    act(() => handlerFor(sock, "disconnect")());
    expect(result.current.isConnected).toBe(false);
    act(() => handlerFor(sock, "online_count")(7));
    expect(result.current.onlineCount).toBe(7);
  });

  it("captures the server id from the serverid event", () => {
    const { result } = render();
    const sock = ioMock.mock.results[0]!.value;

    expect(result.current.serverId).toBeNull();
    act(() => handlerFor(sock, "serverid")("srv-abc-123"));
    expect(result.current.serverId).toBe("srv-abc-123");
  });

  it("re-auths the live socket on auth change and cleans up on unmount", () => {
    let authListener: () => void = () => {};
    onAuthChangeMock.mockImplementation((fn: () => void) => {
      authListener = fn;
      return () => {};
    });

    const { unmount } = render();
    const sock = ioMock.mock.results[0]!.value;

    // Login with a fresh token emits authenticate.
    getSessionId.mockReturnValue("fresh-tok");
    act(() => authListener());
    expect(sock.emit).toHaveBeenCalledWith("authenticate", "fresh-tok");

    // Logout emits deauthenticate.
    getSessionId.mockReturnValue(null);
    act(() => authListener());
    expect(sock.emit).toHaveBeenCalledWith("deauthenticate");

    unmount();
    expect(sock.disconnect).toHaveBeenCalledTimes(1);
  });

  it("throws when used outside a provider", () => {
    // Suppress console.error from React's uncaught error log.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSocket())).toThrow(
      "useSocket must be used within SocketProvider"
    );
    spy.mockRestore();
  });
});
