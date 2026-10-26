import {
  recordVisit,
  __resetForTests,
  getUtcDay,
} from "../../socket/dailyActivity";
import * as dailyActivityRepo from "../../repositories/dailyActivity.repo";
import type { AppSocket } from "../../socket/types";

jest.mock("../../repositories/dailyActivity.repo", () => ({
  upsertVisitor: jest.fn().mockResolvedValue(undefined),
  upgradeGuestToPlayer: jest.fn().mockResolvedValue(undefined),
  deleteVisitor: jest.fn().mockResolvedValue(undefined),
}));

const upsertVisitor = dailyActivityRepo.upsertVisitor as jest.Mock;
const upgradeGuestToPlayer =
  dailyActivityRepo.upgradeGuestToPlayer as jest.Mock;

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

  test("records an authenticated player with p:<playerId> via upgradeGuestToPlayer", async () => {
    const socket = mockSocket("client_abc");
    await recordVisit(socket, { playerId: 42 });

    const today = getUtcDay();
    expect(upgradeGuestToPlayer).toHaveBeenCalledWith({
      day: today,
      guestKey: "c:client_abc",
      playerKey: "p:42",
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

  test("serializes overlapping guest and authenticated recordVisit calls without duplicate rows", async () => {
    const socket = mockSocket("client_race");

    // Simulate slow initial guest upsert
    let resolveGuest!: () => void;
    const slowGuestPromise = new Promise<void>((resolve) => {
      resolveGuest = resolve;
    });
    upsertVisitor.mockImplementationOnce(() => slowGuestPromise);

    // Launch guest visit and immediate auth upgrade concurrently
    const guestCall = recordVisit(socket, null);
    const authCall = recordVisit(socket, { playerId: 55 });

    resolveGuest();
    await Promise.all([guestCall, authCall]);

    // Guest upsert was called first
    expect(upsertVisitor).toHaveBeenCalledTimes(1);
    expect(upsertVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ visitorKey: "c:client_race" })
    );

    // Followed by upgrade
    expect(upgradeGuestToPlayer).toHaveBeenCalledTimes(1);
    expect(upgradeGuestToPlayer).toHaveBeenCalledWith(
      expect.objectContaining({
        guestKey: "c:client_race",
        playerKey: "p:55",
        playerId: 55,
      })
    );

    // A subsequent guest call is dropped because the client is registered today
    await recordVisit(socket, null);
    expect(upsertVisitor).toHaveBeenCalledTimes(1);
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
