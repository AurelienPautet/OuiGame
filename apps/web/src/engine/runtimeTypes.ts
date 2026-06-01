/**
 * Web-local "view" types over the isomorphic game runtime
 * ("@ouigame/shared/game"). The runtime now ships real declarations, but the
 * engine deliberately reads only a loose render-facing slice of each entity —
 * widening the strict runtime/server shapes to just the fields the renderer +
 * particle code touch. The richer shared `Player`/`Bullet`/`Mine` stay
 * assignable to these, so `as RenderBullet[]` / `as RoomPlayer` casts hold.
 */

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
  shoot(room: unknown): void;
  plant(room: unknown): void;
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
  max_bounce?: number;
}

/** The loose mine shape the web engine reads (fuse timing + render fields). */
export interface RenderMine {
  position: { x: number; y: number };
  radius: number;
  timealive: number;
  color?: string;
}
