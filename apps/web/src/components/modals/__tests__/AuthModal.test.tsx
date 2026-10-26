import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";

const {
  closeModal,
  login,
  register,
  googleLogin,
  submitGoogleUsername,
  clearAuthError,
} = vi.hoisted(() => ({
  closeModal: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  googleLogin: vi.fn(),
  submitGoogleUsername: vi.fn(),
  clearAuthError: vi.fn(),
}));

let mockUser: unknown = null;
let mockNeedsGoogleUsername = false;
let mockAuthError: { field: string; messageKey: string } | null = null;

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
    useAuth: () => ({
      login,
      register,
      googleLogin,
      submitGoogleUsername,
      clearAuthError,
      authError: mockAuthError,
      needsGoogleUsername: mockNeedsGoogleUsername,
      user: mockUser,
    }),
  };
});

import { renderWithProviders } from "../../../test/renderWithProviders";
import { AuthModal } from "../AuthModal";

describe("AuthModal", () => {
  let initializeSpy: ReturnType<typeof vi.fn>;
  let renderButtonSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    closeModal.mockClear();
    login.mockClear();
    register.mockClear();
    googleLogin.mockClear();
    submitGoogleUsername.mockClear();
    clearAuthError.mockClear();
    mockUser = null;
    mockNeedsGoogleUsername = false;
    mockAuthError = null;

    AuthModal._resetGsiStateForTesting();

    initializeSpy = vi.fn();
    renderButtonSpy = vi.fn();
    (globalThis as unknown as { google: unknown }).google = {
      accounts: {
        id: {
          initialize: initializeSpy,
          renderButton: renderButtonSpy,
        },
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { google?: unknown }).google;
    AuthModal._resetGsiStateForTesting();
  });

  it("renders the Google Sign-In button on first open without needing a tab switch", () => {
    renderWithProviders(<AuthModal />);

    // Radix Dialog content mounts via a portal.
    expect(screen.getByRole("dialog")).toBeTruthy();

    // GSI should be initialized immediately.
    expect(initializeSpy).toHaveBeenCalledTimes(1);
    expect(initializeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: expect.any(String),
        auto_select: false,
      })
    );

    // The button container should have been passed to renderButton on first render.
    expect(renderButtonSpy).toHaveBeenCalledTimes(1);
    expect(renderButtonSpy).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        text: "signin_with",
        width: "360",
      })
    );
  });

  it("re-renders the button with signup copy when switching to the register tab", () => {
    renderWithProviders(<AuthModal />);

    expect(renderButtonSpy).toHaveBeenCalledTimes(1);

    const registerTab = screen.getByRole("tab", { name: "Register" });
    fireEvent.mouseDown(registerTab, { button: 0, ctrlKey: false });

    expect(renderButtonSpy).toHaveBeenCalledTimes(2);
    expect(renderButtonSpy).toHaveBeenLastCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        text: "signup_with",
      })
    );
  });

  it("routes the GSI credential callback to googleLogin", () => {
    renderWithProviders(<AuthModal />);

    expect(initializeSpy).toHaveBeenCalledTimes(1);
    const initConfig = initializeSpy.mock.calls[0]![0] as {
      callback: (res: { credential: string }) => void;
    };
    expect(initConfig.callback).toBeTypeOf("function");

    initConfig.callback({ credential: "mock-google-jwt-token" });

    expect(googleLogin).toHaveBeenCalledWith("mock-google-jwt-token", "");
  });

  it("submits login credentials when the form is submitted", () => {
    renderWithProviders(<AuthModal />);

    const emailInput = screen.getByPlaceholderText(/email/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);

    fireEvent.change(emailInput, { target: { value: "tanker@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });

    fireEvent.click(screen.getByRole("button", { name: /login|sign in/i }));

    expect(login).toHaveBeenCalledWith("tanker@example.com", "secret123");
  });
});
