import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";

vi.mock("../../../api", () => ({
  adminApi: {
    getOverview: vi.fn(),
    updateUser: vi.fn(),
  },
}));

// hasSession gates every admin query — force it true so the queries run.
vi.mock("../../../lib/storage", () => ({
  storage: { hasSession: () => true },
}));

import { useAdminOverview, useUpdateAdminUser } from "../useAdmin";
import { adminApi } from "../../../api";
import { createQueryWrapper } from "../../../test/queryWrapper";

const getOverview = adminApi.getOverview as ReturnType<typeof vi.fn>;
const updateUser = adminApi.updateUser as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("useAdminOverview", () => {
  it("resolves the overview metrics", async () => {
    const overview = {
      players: { total: 42 },
      generatedAt: "2026-06-19T00:00:00.000Z",
    };
    getOverview.mockResolvedValue(overview);
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminOverview(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(overview);
    expect(getOverview).toHaveBeenCalledTimes(1);
  });

  it("surfaces an error when the request fails", async () => {
    getOverview.mockRejectedValue(new Error("forbidden"));
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminOverview(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUpdateAdminUser", () => {
  it("calls adminApi.updateUser with the id and patch body", async () => {
    updateUser.mockResolvedValue({ success: true });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useUpdateAdminUser(), { wrapper });

    result.current.mutate({ id: 7, isAdmin: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateUser).toHaveBeenCalledWith(7, { isAdmin: true });
  });
});
