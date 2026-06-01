import { registerOnlineCount } from "../../socket/onlineCount";
import { makeIo, makeSocket } from "../helpers/socketDoubles";

// Fake timers drive the 60s broadcast interval and the setImmediate-deferred
// connect/disconnect broadcasts.

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function setup() {
  const io = makeIo();
  let connectionHandler: ((socket: unknown) => void) | undefined;
  io.on = jest.fn((event: string, cb: (socket: unknown) => void) => {
    if (event === "connection") connectionHandler = cb;
  }) as never;
  jest.spyOn(console, "log").mockImplementation(() => {});
  registerOnlineCount({ io: io as never });
  return { io, connection: connectionHandler! };
}

test("broadcasts the client count every minute", () => {
  const { io } = setup();
  io.engine.clientsCount = 5;
  jest.advanceTimersByTime(60000);
  expect(io.__emits.find((e) => e.event === "online_count")?.args).toEqual([5]);
});

test("broadcasts the count on connection (after a deferred tick)", () => {
  const { io, connection } = setup();
  io.engine.clientsCount = 3;
  connection(makeSocket());
  jest.runOnlyPendingTimers(); // flush the setImmediate
  expect(io.__emits.some((e) => e.event === "online_count")).toBe(true);
  expect(io.__emits.find((e) => e.event === "online_count")?.args).toEqual([3]);
});

test("broadcasts the count on disconnect", () => {
  const { io, connection } = setup();
  const socket = makeSocket();
  connection(socket);
  io.__emits.length = 0; // drop the connection broadcast
  io.engine.clientsCount = 2;

  socket.__emit("disconnect");
  jest.runOnlyPendingTimers();

  expect(io.__emits.find((e) => e.event === "online_count")?.args).toEqual([2]);
});
