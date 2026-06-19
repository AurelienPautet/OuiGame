import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// --- Mocks --------------------------------------------------------------------
// A hoisted spy lets each test swap what `useAuth` returns before rendering.
const useAuth = vi.fn();

vi.mock("../../../contexts", () => ({
  useAuth: () => useAuth(),
}));

import { ProtectedAdminRoute } from "../ProtectedAdminRoute";

// Render the guard at "/admin" with a "/" landing route, so a <Navigate to="/">
// redirect is observable via the home marker rather than the guarded child.
const renderGuard = () =>
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/" element={<div>HOME</div>} />
        <Route
          path="/admin"
          element={
            <ProtectedAdminRoute>
              <div>SECRET DASHBOARD</div>
            </ProtectedAdminRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("ProtectedAdminRoute", () => {
  it("renders the children for an admin user", () => {
    useAuth.mockReturnValue({
      user: { username: "root", email: "r@x", isAdmin: true },
      isLoading: false,
    });
    renderGuard();
    expect(screen.getByText("SECRET DASHBOARD")).toBeTruthy();
    expect(screen.queryByText("HOME")).toBeNull();
  });

  it("redirects a logged-in non-admin to home", () => {
    useAuth.mockReturnValue({
      user: { username: "joe", email: "j@x", isAdmin: false },
      isLoading: false,
    });
    renderGuard();
    expect(screen.queryByText("SECRET DASHBOARD")).toBeNull();
    expect(screen.getByText("HOME")).toBeTruthy();
  });

  it("redirects an anonymous visitor to home", () => {
    useAuth.mockReturnValue({ user: null, isLoading: false });
    renderGuard();
    expect(screen.queryByText("SECRET DASHBOARD")).toBeNull();
    expect(screen.getByText("HOME")).toBeTruthy();
  });

  it("shows a loading state while the session is still verifying", () => {
    useAuth.mockReturnValue({ user: null, isLoading: true });
    renderGuard();
    expect(screen.queryByText("SECRET DASHBOARD")).toBeNull();
    expect(screen.queryByText("HOME")).toBeNull();
  });
});
