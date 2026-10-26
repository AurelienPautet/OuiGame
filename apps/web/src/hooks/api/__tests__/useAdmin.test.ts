import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";

vi.mock("../../../api", () => ({
  adminApi: {
    getOverview: vi.fn(),
    getTimeseries: vi.fn(),
    updateUser: vi.fn(),
    getLevelThumbnailSources: vi.fn(),
    updateLevelThumbnail: vi.fn(),
  },
}));

// The renderer needs a real 2D canvas, so stub the render/parse boundary and
// exercise the job loop (paging, skips, stop) instead.
vi.mock("../../../lib/levelThumbnail", () => ({
  levelLayoutFromContent: vi.fn(),
  renderLevelThumbnailHex: vi.fn(),
}));

// hasSession gates every admin query — force it true so the queries run.
vi.mock("../../../lib/storage", () => ({
  storage: { hasSession: () => true },
}));

import {
  useAdminOverview,
  useAdminTimeseries,
  useUpdateAdminUser,
  useRerenderAdminLevelThumbnails,
} from "../useAdmin";
import { adminApi } from "../../../api";
import {
  levelLayoutFromContent,
  renderLevelThumbnailHex,
} from "../../../lib/levelThumbnail";
import { createQueryWrapper } from "../../../test/queryWrapper";

const getOverview = adminApi.getOverview as ReturnType<typeof vi.fn>;
const getTimeseries = adminApi.getTimeseries as ReturnType<typeof vi.fn>;
const updateUser = adminApi.updateUser as ReturnType<typeof vi.fn>;
const getLevelThumbnailSources =
  adminApi.getLevelThumbnailSources as ReturnType<typeof vi.fn>;
const updateLevelThumbnail = adminApi.updateLevelThumbnail as ReturnType<
  typeof vi.fn
>;
const parseLayout = levelLayoutFromContent as ReturnType<typeof vi.fn>;
const renderHex = renderLevelThumbnailHex as ReturnType<typeof vi.fn>;

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

describe("useRerenderAdminLevelThumbnails", () => {
  // A catalog page shaped like the admin thumbnails endpoint returns.
  const page = (
    levels: { id: number; name: string; content: unknown }[],
    total: number,
    pageNumber: number
  ) => ({ levels, total, page: pageNumber, pageSize: 100 });

  it("walks every page, renders+uploads each level and counts malformed rows as skipped", async () => {
    // Page 1: one renderable level + one malformed row. Page 2: one renderable
    // level (total 3 → the loop must fetch the second page).
    getLevelThumbnailSources
      .mockResolvedValueOnce(
        page(
          [
            { id: 1, name: "A", content: { data: [1] } },
            { id: 2, name: "B", content: {} },
          ],
          3,
          1
        )
      )
      .mockResolvedValueOnce(
        page([{ id: 3, name: "C", content: { data: [2] } }], 3, 2)
      );
    parseLayout.mockImplementation((content: unknown) => {
      const data = (content as { data?: unknown }).data;
      return Array.isArray(data) ? data : null;
    });
    renderHex.mockReturnValue("ffd8");
    updateLevelThumbnail.mockResolvedValue({ success: true });

    const progress = vi.fn();
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useRerenderAdminLevelThumbnails(), {
      wrapper,
    });

    result.current.mutate({ onProgress: progress });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      done: 2,
      total: 3,
      failed: 1,
      stopped: false,
    });
    expect(getLevelThumbnailSources).toHaveBeenCalledTimes(2);
    expect(getLevelThumbnailSources).toHaveBeenNthCalledWith(1, {
      page: 1,
      pageSize: 100,
    });
    expect(getLevelThumbnailSources).toHaveBeenNthCalledWith(2, {
      page: 2,
      pageSize: 100,
    });
    expect(updateLevelThumbnail).toHaveBeenCalledTimes(2);
    expect(updateLevelThumbnail).toHaveBeenCalledWith(1, {
      hexData: "ffd8",
    });
    expect(updateLevelThumbnail).toHaveBeenCalledWith(3, {
      hexData: "ffd8",
    });
    // One progress tick per level (skips included).
    expect(progress).toHaveBeenCalledTimes(3);
    expect(progress).toHaveBeenCalledWith({ done: 2, total: 3, failed: 1 });
  });

  it("counts a failed upload as skipped and keeps going", async () => {
    getLevelThumbnailSources.mockResolvedValueOnce(
      page(
        [
          { id: 1, name: "A", content: { data: [1] } },
          { id: 2, name: "B", content: { data: [2] } },
        ],
        2,
        1
      )
    );
    parseLayout.mockImplementation((content: unknown) => {
      const data = (content as { data?: unknown }).data;
      return Array.isArray(data) ? data : null;
    });
    renderHex.mockReturnValue("ffd8");
    updateLevelThumbnail
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce({ success: true });

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useRerenderAdminLevelThumbnails(), {
      wrapper,
    });

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      done: 1,
      total: 2,
      failed: 1,
      stopped: false,
    });
  });

  it("stops between levels when shouldStop turns true", async () => {
    getLevelThumbnailSources.mockResolvedValueOnce(
      page(
        [
          { id: 1, name: "A", content: { data: [1] } },
          { id: 2, name: "B", content: { data: [2] } },
          { id: 3, name: "C", content: { data: [3] } },
        ],
        3,
        1
      )
    );
    parseLayout.mockImplementation((content: unknown) => {
      const data = (content as { data?: unknown }).data;
      return Array.isArray(data) ? data : null;
    });
    renderHex.mockReturnValue("ffd8");
    updateLevelThumbnail.mockResolvedValue({ success: true });

    const shouldStop = vi.fn();
    shouldStop.mockReturnValueOnce(false).mockReturnValue(true);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useRerenderAdminLevelThumbnails(), {
      wrapper,
    });

    result.current.mutate({ shouldStop });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      done: 1,
      total: 3,
      failed: 0,
      stopped: true,
    });
    expect(updateLevelThumbnail).toHaveBeenCalledTimes(1);
  });

  it("rejects when the catalog request itself fails", async () => {
    getLevelThumbnailSources.mockRejectedValueOnce(new Error("forbidden"));

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useRerenderAdminLevelThumbnails(), {
      wrapper,
    });

    result.current.mutate(undefined);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useAdminTimeseries", () => {
  it("fetches timeseries with named range", async () => {
    const points = [{ date: "14:00", games: 5 }];
    getTimeseries.mockResolvedValue(points);
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminTimeseries("24h"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(points);
    expect(getTimeseries).toHaveBeenCalledWith({ range: "24h" });
  });

  it("fetches timeseries with numeric days", async () => {
    const points = [{ date: "2026-10-26", games: 10 }];
    getTimeseries.mockResolvedValue(points);
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminTimeseries(7), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(points);
    expect(getTimeseries).toHaveBeenCalledWith({ days: 7 });
  });
});
