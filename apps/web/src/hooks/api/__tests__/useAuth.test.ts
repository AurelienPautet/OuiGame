import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";

vi.mock("../../../api", () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    googleLogin: vi.fn(),
    logout: vi.fn(),
    verifySession: vi.fn(),
  },
}));
vi.mock("../../../lib/storage", () => ({
  storage: {
    setSessionId: vi.fn(),
    clearSessionId: vi.fn(),
    getSessionId: vi.fn(),
    hasSession: vi.fn(() => false),
  },
}));
vi.mock("../../../api/authEvents", () => ({ notifyAuthChange: vi.fn() }));

import { useLogin, useLogout } from "../useAuth";
import { authApi } from "../../../api";
import { storage } from "../../../lib/storage";
import { notifyAuthChange } from "../../../api/authEvents";
import { createQueryWrapper } from "../../../test/queryWrapper";

const api = authApi as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("useLogin", () => {
  it("stores the token, seeds the session cache, and notifies on success", async () => {
    api.login.mockResolvedValue({
      sessionToken: "tok",
      username: "u",
      email: "e@x.com",
    });
    const { client, wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ email: "e@x.com", password: "p" });
    });

    expect(storage.setSessionId).toHaveBeenCalledWith("tok");
    expect(client.getQueryData(["auth", "session"])).toEqual({
      username: "u",
      email: "e@x.com",
    });
    expect(notifyAuthChange).toHaveBeenCalled();
  });
});

describe("useLogout", () => {
  it("clears the session, nulls the cache, invalidates user data, and notifies", async () => {
    api.logout.mockResolvedValue({});
    const { client, wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(storage.clearSessionId).toHaveBeenCalled();
    expect(client.getQueryData(["auth", "session"])).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["auth"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["myLevels"] });
    expect(notifyAuthChange).toHaveBeenCalled();
  });

  it("still clears local session when the server logout fails (onError)", async () => {
    api.logout.mockRejectedValue(new Error("500"));
    const { client, wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(storage.clearSessionId).toHaveBeenCalled();
    expect(client.getQueryData(["auth", "session"])).toBeNull();
    expect(notifyAuthChange).toHaveBeenCalled();
  });
});
