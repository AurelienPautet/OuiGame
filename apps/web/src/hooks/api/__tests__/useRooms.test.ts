import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";

vi.mock("../../../api", () => ({ roomsApi: { getRooms: vi.fn() } }));

import { useRooms } from "../useRooms";
import { roomsApi } from "../../../api";
import { createQueryWrapper } from "../../../test/queryWrapper";

const getRooms = roomsApi.getRooms as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("useRooms", () => {
  it("resolves the rooms list", async () => {
    const list = { room_ids: [1], room_names: ["A"] };
    getRooms.mockResolvedValue(list);
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useRooms(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(list);
  });

  it("surfaces an error when the request fails", async () => {
    getRooms.mockRejectedValue(new Error("down"));
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useRooms(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
