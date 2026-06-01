// Test doubles for the socket.io server/socket used by the registry, tick loop,
// and connection-handler suites. Not a test file (Jest's testMatch only collects
// *.test.ts), so it's imported as a helper.
//
// makeIo() records every emit (both `io.to(target).emit` and `io.emit`) on
// `__emits`. makeSocket() records the handlers registered via `socket.on` so a
// test can invoke a single event handler in isolation via `__emit`.

interface RecordedEmit {
  target: string | number | null;
  event: string;
  args: unknown[];
}

export interface FakeIo {
  to: (target: string | number) => {
    emit: (event: string, ...args: unknown[]) => void;
  };
  emit: (event: string, ...args: unknown[]) => void;
  on: jest.Mock;
  engine: { clientsCount: number };
  __emits: RecordedEmit[];
}

export function makeIo(): FakeIo {
  const __emits: RecordedEmit[] = [];
  return {
    to(target) {
      return {
        emit(event, ...args) {
          __emits.push({ target, event, args });
        },
      };
    },
    emit(event, ...args) {
      __emits.push({ target: null, event, args });
    },
    on: jest.fn(),
    engine: { clientsCount: 0 },
    __emits,
  };
}

export interface FakeSocket {
  id: string;
  data: Record<string, unknown>;
  handshake: { auth: Record<string, unknown> };
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
  on: jest.Mock;
  __handlers: Record<string, (...args: unknown[]) => unknown>;
  __emit: (event: string, ...args: unknown[]) => unknown;
}

export function makeSocket(
  id = "sock1",
  auth: Record<string, unknown> = {}
): FakeSocket {
  const __handlers: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    id,
    data: {},
    handshake: { auth },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    on: jest.fn((event: string, h: (...args: unknown[]) => unknown) => {
      __handlers[event] = h;
    }),
    __handlers,
    __emit(event, ...args) {
      return __handlers[event]?.(...args);
    },
  };
}
