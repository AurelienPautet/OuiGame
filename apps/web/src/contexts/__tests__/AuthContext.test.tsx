import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, cleanup } from "@testing-library/react";

vi.mock("../../hooks/api", () => ({
  useVerifySession: vi.fn(),
  useLogin: vi.fn(),
  useSignup: vi.fn(),
  useGoogleLogin: vi.fn(),
  useLogout: vi.fn(),
}));

import {
  useVerifySession,
  useLogin,
  useSignup,
  useGoogleLogin,
  useLogout,
} from "../../hooks/api";
import { AuthProvider, useAuth } from "../AuthContext";

const m = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

function mutationStub(over: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isPending: false,
    mutate: vi.fn(),
    reset: vi.fn(),
    ...over,
  };
}

// A thrown api-client error: a real Error plus the structured `data` envelope.
const apiError = (message: string, data?: object) =>
  Object.assign(new Error(message), data ? { data } : {});

let login: ReturnType<typeof mutationStub>;
let signup: ReturnType<typeof mutationStub>;
let google: ReturnType<typeof mutationStub>;
let logout: ReturnType<typeof mutationStub>;

beforeEach(() => {
  vi.clearAllMocks();
  login = mutationStub();
  signup = mutationStub();
  google = mutationStub();
  logout = mutationStub();
  m(useVerifySession).mockReturnValue({ data: undefined, isLoading: false });
  m(useLogin).mockReturnValue(login);
  m(useSignup).mockReturnValue(signup);
  m(useGoogleLogin).mockReturnValue(google);
  m(useLogout).mockReturnValue(logout);
});
afterEach(() => cleanup());

const render = () => renderHook(() => useAuth(), { wrapper: AuthProvider });

describe("authError field mapping", () => {
  it("maps a login email error to the email field", () => {
    login.error = apiError("x", { error: "email" });
    const { result } = render();
    expect(result.current.authError).toEqual({
      field: "email",
      message: "Email not found",
    });
  });

  it("maps an unrecognised login error to the general field", () => {
    login.error = apiError("server exploded");
    const { result } = render();
    expect(result.current.authError).toEqual({
      field: "general",
      message: "server exploded",
    });
  });

  it("maps a signup username error to the username field", () => {
    signup.error = apiError("x", { error: "username" });
    const { result } = render();
    expect(result.current.authError?.field).toBe("username");
  });
});

describe("loading + reset + google flow", () => {
  it("aggregates isLoading from any pending mutation", () => {
    login.isPending = true;
    const { result } = render();
    expect(result.current.isLoading).toBe(true);
  });

  it("clearAuthError resets all three mutations", () => {
    const { result } = render();
    act(() => result.current.clearAuthError());
    expect(login.reset).toHaveBeenCalled();
    expect(signup.reset).toHaveBeenCalled();
    expect(google.reset).toHaveBeenCalled();
  });

  it("sets needsGoogleUsername when google login reports username_required", () => {
    const { result } = render();
    act(() => result.current.googleLogin("id-token"));

    // The provider passes mutate(vars, { onError, onSuccess }); fire onError.
    const [vars, opts] = google.mutate.mock.calls[0];
    expect(vars).toEqual({ idToken: "id-token", username: "" });
    act(() => opts.onError(apiError("x", { error: "username_required" })));
    expect(result.current.needsGoogleUsername).toBe(true);
  });
});
