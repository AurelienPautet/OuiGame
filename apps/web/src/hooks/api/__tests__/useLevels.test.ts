import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";

vi.mock("../../../api", () => ({
  levelsApi: {
    getLevels: vi.fn(),
    getMyLevels: vi.fn(),
    getLevel: vi.fn(),
    getLevelJson: vi.fn(),
    createLevel: vi.fn(),
    updateLevel: vi.fn(),
    deleteLevel: vi.fn(),
    rateLevel: vi.fn(),
  },
}));
vi.mock("../../../lib/storage", () => ({ storage: { hasSession: vi.fn() } }));

import {
  useLevels,
  useMyLevels,
  useLevel,
  useSaveLevel,
  useRateLevel,
} from "../useLevels";
import { levelsApi } from "../../../api";
import { storage } from "../../../lib/storage";
import { createQueryWrapper } from "../../../test/queryWrapper";

const api = levelsApi as Record<string, ReturnType<typeof vi.fn>>;
const hasSession = storage.hasSession as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("useLevels query", () => {
  it("returns the fetched levels", async () => {
    api.getLevels.mockResolvedValue([{ level_id: 1 }]);
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLevels({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ level_id: 1 }]);
  });
});

describe("enabled gating", () => {
  it("does not fetch my levels without a session", () => {
    hasSession.mockReturnValue(false);
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMyLevels({}), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.getMyLevels).not.toHaveBeenCalled();
  });

  it("does not fetch a level with a falsy id", () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLevel(0), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(api.getLevel).not.toHaveBeenCalled();
  });
});

describe("mutations", () => {
  it("useSaveLevel creates without an id and updates with one, invalidating levels", async () => {
    api.createLevel.mockResolvedValue({ level_id: 9 });
    api.updateLevel.mockResolvedValue({ success: true });
    const { client, wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useSaveLevel(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ levelName: "L" } as never);
    });
    expect(api.createLevel).toHaveBeenCalledWith({ levelName: "L" });

    await act(async () => {
      await result.current.mutateAsync({ id: 5, levelName: "L" } as never);
    });
    expect(api.updateLevel).toHaveBeenCalledWith(5, { levelName: "L" });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["levels"] })
    );
  });

  it("useRateLevel invalidates the rated level's query", async () => {
    api.rateLevel.mockResolvedValue({ success: true });
    const { client, wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRateLevel(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ levelId: 7, stars: 4 });
    });
    expect(api.rateLevel).toHaveBeenCalledWith(7, 4);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["levels", 7] });
  });
});
