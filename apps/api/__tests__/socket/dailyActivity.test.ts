import {
  recordVisit,
  __resetForTests,
  getUtcDay,
} from "../../socket/dailyActivity";
import * as dailyActivityRepo from "../../repositories/dailyActivity.repo";
import type { AppSocket } from "../../socket/types";

jest.mock("../../repositories/dailyActivity.repo", () => ({
  upsertVisitor: jest.fn().mockResolvedValue(undefined),
  deleteVisitor: jest.fn().mockResolvedValue(undefined),
}));

const upsertVisitor = dailyActivityRepo.upsertVisitor as jest.Mock;
const deleteVisitor = dailyActivityRepo.deleteVisitor as jest.Mock;

function mockSocket(clientId?: string, socketId = "sock_1"): AppSocket {
  return {
    id: socketId,
    data: {
      clientId,
    },
  } as unknown as AppSocket;
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetForTests();
});

describe("dailyActivity.recordVisit", () => {
  test("records a guest visitor with c:<clientId> and playerId: null", async () => {
    const socket = mockSocket("client_abc");
    await recordVisit(socket, null);

    const today = getUtcDay();
    expect(upsertVisitor).toHaveBeenCalledTimes(1);
    expect(upsertVisitor).toHaveBeenCalledWith({
      day: today,
      visitorKey: "c:client_abc",
      playerId: null,
    });
  });

  test("falls back to socket.id when clientId is absent", async () => {
    const socket = mockSocket(undefined, "fallback_sock_9");
    await recordVisit(socket, null);

    const today = getUtcDay();
    expect(upsertVisitor).toHaveBeenCalledTimes(1);
    expect(upsertVisitor).toHaveBeenCalledWith({
      day: today,
      visitorKey: "c:fallback_sock_9",
      playerId: null,
    });
  });

  test("records an authenticated player with p:<playerId> and deletes guest key", async () => {
    const socket = mockSocket("client_abc");
    await recordVisit(socket, { playerId: 42 });

    const today = getUtcDay();
    expect(deleteVisitor).toHaveBeenCalledWith(today, "c:client_abc");
    expect(upsertVisitor).toHaveBeenCalledWith({
      day: today,
      visitorKey: "p:42",
      playerId: 42,
    });
  });

  test("deduplicates repeated visits on the same day in memory", async () => {
    const socket = mockSocket("client_abc");
    await recordVisit(socket, null);
    await recordVisit(socket, null);
    await recordVisit(socket, null);

    expect(upsertVisitor).toHaveBeenCalledTimes(1);
  });

  test("upgrades guest to registered player on login without duplicate counts", async () => {
    const socket = mockSocket("client_abc");
    // Connects as guest first
    await recordVisit(socket, null);
    expect(upsertVisitor).toHaveBeenCalledTimes(1);
    expect(upsertVisitor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visitorKey: "c:client_abc",
        playerId: null,
      })
    );

    // Logs in later
    await recordVisit(socket, { playerId: 99 });
    const today = getUtcDay();
    expect(deleteVisitor).toHaveBeenCalledWith(today, "c:client_abc");
    expect(upsertVisitor).toHaveBeenCalledTimes(2);
    expect(upsertVisitor).toHaveBeenLastCalledWith({
      day: today,
      visitorKey: "p:99",
      playerId: 99,
    });

    // Repeated call for the player is deduplicated
    await recordVisit(socket, { playerId: 99 });
    expect(upsertVisitor).toHaveBeenCalledTimes(2);
  });

  test("swallows repo errors gracefully without throwing", async () => {
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    upsertVisitor.mockRejectedValueOnce(new Error("db down"));

    const socket = mockSocket("client_xyz");
    await expect(recordVisit(socket, null)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
