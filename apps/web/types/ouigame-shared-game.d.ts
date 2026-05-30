/**
 * Web-local ambient surface for the isomorphic game runtime exposed at
 * "@ouigame/shared/game". The package's "./game" export currently only ships a
 * runtime ("import" -> "./dist/game.js") with no bundled .d.ts, so the web app
 * declares the slice of the API its engine actually touches here. This is a
 * loose contract on purpose — the source of truth is the JS runtime.
 */
declare module "@ouigame/shared/game" {
  /** A single player/bot living inside a Room (keyed by socket id). */
  export interface RoomPlayer {
    alive?: boolean;
    direction?: { x: number; y: number };
    aim?: { x: number; y: number };
    bulletcount?: number;
    round_stats?: {
      stats?: Record<string, number>;
      [key: string]: unknown;
    };
    shoot(room: Room): void;
    plant(room: Room): void;
    [key: string]: unknown;
  }

  /** The authoritative game simulation, run identically on client (solo) and server. */
  export class Room {
    constructor(...args: unknown[]);
    players: Record<string, RoomPlayer>;
    blocks: unknown[];
    Bcollision: unknown[];
    bullets: unknown[];
    mines: unknown[];
    holes: unknown[];
    sounds: unknown[];
    grid_id: unknown;
    maxplayernb: number;
    spawn_new_player(
      name: string,
      turret: string,
      body: string,
      socketId: string
    ): void;
    spawn_all_bots(): void;
    update(
      fpsCorrector: number,
      ctx?: CanvasRenderingContext2D,
      debug?: boolean
    ): boolean;
    [key: string]: unknown;
  }

  /**
   * The loose bullet shape the web engine reads off the runtime / server tick.
   * Only the fields the render + particle code touches are modelled, so the
   * richer shared `Bullet` snapshot remains assignable to it.
   */
  export interface RenderBullet {
    position: { x: number; y: number };
    size: { w: number; h: number };
    angle: number;
    type?: number;
    bounce?: number;
  }

  /** The loose mine shape the web engine reads (fuse timing + render fields). */
  export interface RenderMine {
    position: { x: number; y: number };
    radius: number;
    timealive: number;
    color?: string;
  }

  export function makeid(length: number): string;
  export function loadlevel(data: unknown, room: Room): void | Promise<void>;
}
