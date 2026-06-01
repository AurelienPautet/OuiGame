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
vi.mock("../../lib/storage", () => ({ storage: { getSessionId: vi.fn() } }));

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
    expect(cb).toHaveBeenCalledWith({ token: "tok" });
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

  it("re-auths the live socket on auth change and cleans up on unmount", () => {
    const { unmount } = render();
    const sock = ioMock.mock.results[0]!.value;
    const authCb = onAuthChangeMock.mock.calls[0]![0];

    getSessionId.mockReturnValue("tok2");
    act(() => authCb());
    expect(sock.emit).toHaveBeenCalledWith("authenticate", "tok2");

    getSessionId.mockReturnValue(null);
    act(() => authCb());
    expect(sock.emit).toHaveBeenCalledWith("deauthenticate");

    unmount();
    expect(sock.disconnect).toHaveBeenCalled();
  });

  it("throws when used outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useSocket())).toThrow(
      /must be used within SocketProvider/
    );
  });
});
