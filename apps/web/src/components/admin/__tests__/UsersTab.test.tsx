import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { AdminUserListItem } from "@ouigame/shared/api";

// --- Mocks --------------------------------------------------------------------
// The mutation spy is hoisted so the factory below can close over it.
const mutate = vi.fn();

vi.mock("../../../hooks/api", () => ({
  useAdminUsers: vi.fn(),
  useUpdateAdminUser: () => ({ mutate, isPending: false }),
  useDeleteAdminUser: () => ({ mutate: vi.fn(), isPending: false }),
  useAdminUser: () => ({ data: undefined, isLoading: true, isError: false }),
}));

vi.mock("../../../contexts", () => ({
  // "me" is someone NOT in the table, so no row is the self row.
  useAuth: () => ({ user: { username: "root", email: "r@x", isAdmin: true } }),
}));

import { useAdminUsers } from "../../../hooks/api";
import { UsersTab } from "../UsersTab";

const useAdminUsersMock = useAdminUsers as unknown as ReturnType<typeof vi.fn>;

const makeUser = (over: Partial<AdminUserListItem>): AdminUserListItem => ({
  id: 1,
  username: "alpha",
  email: "alpha@x.com",
  type: "db",
  isAdmin: false,
  createdAt: "2024-01-01T00:00:00.000Z",
  lastLoginAt: "2024-02-01T00:00:00.000Z",
  onlineRounds: 10,
  soloRounds: 5,
  kills: 42,
  wins: 7,
  levelsCreated: 2,
  campaignsCreated: 1,
  achievements: 3,
  ...over,
});

const SAMPLE: AdminUserListItem[] = [
  makeUser({ id: 1, username: "alpha", isAdmin: false }),
  makeUser({ id: 2, username: "beta", isAdmin: true }),
];

beforeEach(() => {
  vi.clearAllMocks();
  useAdminUsersMock.mockReturnValue({
    data: { users: SAMPLE, total: 2, page: 1, pageSize: 25 },
    isLoading: false,
    isError: false,
  });
});
afterEach(() => cleanup());

describe("UsersTab", () => {
  it("renders the user rows", () => {
    render(<UsersTab />);
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText("beta")).toBeTruthy();
    expect(screen.getByText("2 users")).toBeTruthy();
  });

  it("shows an empty state when there are no users", () => {
    useAdminUsersMock.mockReturnValue({
      data: { users: [], total: 0, page: 1, pageSize: 25 },
      isLoading: false,
      isError: false,
    });
    render(<UsersTab />);
    expect(screen.getByText(/No users match/i)).toBeTruthy();
  });

  it("promoting a user calls the update mutation with isAdmin true", () => {
    render(<UsersTab />);

    // alpha is not an admin → the row exposes a "Promote user" action.
    fireEvent.click(screen.getByLabelText("Promote user"));

    // A confirm dialog appears; clicking Confirm fires the mutation.
    const confirm = screen.getByRole("button", { name: "Confirm" });
    fireEvent.click(confirm);

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({ id: 1, isAdmin: true });
  });

  it("disables destructive actions on your own row", () => {
    // Make beta the logged-in user so its row is the self row.
    useAdminUsersMock.mockReturnValue({
      data: {
        users: [makeUser({ id: 9, username: "root", isAdmin: true })],
        total: 1,
        page: 1,
        pageSize: 25,
      },
      isLoading: false,
      isError: false,
    });
    render(<UsersTab />);
    expect(screen.getByText("You")).toBeTruthy();
    expect(
      (screen.getByLabelText("Delete user") as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
