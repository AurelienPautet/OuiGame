// Local ambient types for @ouigame/shared/game. That package is built by tsup
// with dts:false (the game runtime is still untyped JS), so it ships no .d.ts.
// Rather than let it cascade to `any`, declare the minimum surface the api
// actually uses (Room/loadlevel/makeid). Room is an opaque, mutated handle —
// type the hot members the server/tick-loop/registry read or write and leave
// the rest open via the index signature. (Superseded once the game runtime is
// itself typed, in a later phase.)
declare module "@ouigame/shared/game" {
  export function makeid(length: number): string;
  export function loadlevel(data: unknown, room: Room): void | Promise<void>;

  // The per-round counters the tick loop persists via stats.repo.insertRound.
  export interface RoundStatCounters {
    kills: number;
    deaths: number;
    wins: number;
    shots: number;
    hits: number;
    plants: number;
    blocks_destroyed: number;
  }

  export interface RoomPlayer {
    position?: { x: number; y: number };
    direction?: { x: number; y: number };
    aim?: { x: number; y: number };
    mytick?: number;
    round_stats: { stats: RoundStatCounters; reset(): void };
    shoot(room: Room): void;
    plant(room: Room): void;
    [key: string]: unknown;
  }

  export class Room {
    constructor(
      name: string,
      rounds: number,
      listId: number[],
      creator: string,
      io: unknown
    );
    id: number;
    name: string;
    creator: string;
    maxplayernb: number;
    levels: number[];
    levelid: number;
    blocks: unknown;
    Bcollision: unknown;
    ids: string[];
    players: Record<string, RoomPlayer>;
    io: {
      to(room: string | number): {
        emit(event: string, ...args: unknown[]): void;
      };
    };
    countdownActive: boolean;
    countdownDuration: number;
    spawn_new_player(
      name: string,
      turretc: string,
      bodyc: string,
      socketId: string
    ): void;
    delete_player(socketId: string): void;
    respawn_the_room(): void;
    update(fpsCorrector: number): boolean;
    [key: string]: unknown;
  }
}
