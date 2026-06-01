import { getEdges, intersectRaySegment } from "./check_intersect.js";
import type { CollisionSide } from "./check_collision.js";
import type { Vec2, Size } from "./types.js";
import type { CollisionBox } from "./CollisionBox.js";
import type { Player } from "./Player.js";
import type { Room } from "./Room.js";

// Hardening against tunneling: a bullet is swept along its movement vector with
// continuous (raycast) collision instead of a discrete point test, so it can
// never skip through a wall in a single step regardless of its speed. Up to this
// many reflections are resolved within one step (corners), after which any
// leftover travel is dropped — negligible at the fixed 60 Hz step.
const MAX_BOUNCES_PER_STEP = 4;

// Tiny skin pushed off a surface after a reflection so the next sweep starts
// strictly outside the wall and never re-detects the same face at distance 0.
const SKIN = 0.01;

// A wall hit found while sweeping the bullet centre: `t` is the fraction along
// the current sub-displacement, `(x,y)` the impact point (bullet centre), and
// `horizontal` whether the touched edge is horizontal (reflect Y) or vertical
// (reflect X).
interface SweepHit {
  t: number;
  x: number;
  y: number;
  horizontal: boolean;
  wall: CollisionBox;
}

// Nearest intersection of the segment (cx,cy)->(cx+dx,cy+dy) with any wall,
// where each wall is inflated by the bullet's half-extents (Minkowski sum) so
// the bullet centre can be treated as a point. `ignore` skips the wall just hit
// this step.
function sweepCentreVsWalls(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  walls: CollisionBox[],
  halfW: number,
  halfH: number,
  ignore: CollisionBox | null
): SweepHit | null {
  let best: SweepHit | null = null;
  const origin = { x: cx, y: cy };
  const dir = { x: dx, y: dy };
  for (const wall of walls) {
    if (wall === ignore) continue;
    const rect = {
      x: wall.position.x - halfW,
      y: wall.position.y - halfH,
      w: wall.size.w + halfW * 2,
      h: wall.size.h + halfH * 2,
    };
    const edges = getEdges(rect);
    for (let i = 0; i < edges.length; i++) {
      const [p1, p2] = edges[i]!;
      const r = intersectRaySegment(origin, dir, p1, p2);
      if (r === null) continue;
      // `dist` is the fraction along `dir`; only hits within this step count.
      if (r.dist < 0 || r.dist > 1) continue;
      if (best === null || r.dist < best.t) {
        // getEdges order is [top, right, bottom, left]; even indices are the
        // horizontal edges.
        best = { t: r.dist, x: r.x, y: r.y, horizontal: i % 2 === 0, wall };
      }
    }
  }
  return best;
}

// If the bullet centre starts inside an inflated wall (e.g. spawned against
// geometry), pop it out to the nearest face so the sweep never reflects from the
// inside. Rare, but keeps the simulation well-defined.
function resolveStartOverlap(
  centre: Vec2,
  walls: CollisionBox[],
  halfW: number,
  halfH: number
): void {
  for (const wall of walls) {
    const ex = wall.position.x - halfW;
    const ey = wall.position.y - halfH;
    const ew = wall.size.w + halfW * 2;
    const eh = wall.size.h + halfH * 2;
    if (
      centre.x > ex &&
      centre.x < ex + ew &&
      centre.y > ey &&
      centre.y < ey + eh
    ) {
      const dl = centre.x - ex;
      const dr = ex + ew - centre.x;
      const dt = centre.y - ey;
      const db = ey + eh - centre.y;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) centre.x = ex;
      else if (m === dr) centre.x = ex + ew;
      else if (m === dt) centre.y = ey;
      else centre.y = ey + eh;
    }
  }
}

export class Bullet {
  // Stable per-bullet id, used to match a bullet across simulation steps (render
  // interpolation) and across server snapshots (online interpolation).
  static _nextId = 1;
  id: number;
  type: number;
  velocity: Vec2; // px/second
  angle: number;
  size: Size;
  position: Vec2;
  draw_size: Size;
  last_collision_object: CollisionBox | null;
  mytick: number;
  bounce: number;
  max_bounce: number;
  emitter: Player;
  side?: CollisionSide;

  constructor(
    position: Vec2,
    angle: number,
    speed: number,
    size: Size,
    max_bounce: number,
    type: number,
    emitter: Player,
    room: Room
  ) {
    this.id = Bullet._nextId++;
    this.type = type;
    this.velocity = {
      x: -Math.cos(angle) * speed,
      y: -Math.sin(angle) * speed,
    };
    this.angle = angle;
    this.size = size;
    this.position = {
      x: position.x - this.size.w / 2,
      y: position.y - this.size.h / 2,
    };
    this.draw_size = {
      w: this.size.w * 1.5,
      h: this.size.h,
    };
    this.last_collision_object = null;
    this.mytick = 0;
    this.bounce = 0;
    this.max_bounce = max_bounce;
    this.emitter = emitter;
    this.emitter.bulletcount++;
    this.emitter.round_stats.stats.shots++;
    room.sounds.shoot = true;
    room.bullets.push(this);
    room.emit_to_room("shoot_explosion", {
      position: {
        x: this.emitter.endpos.x,
        y: this.emitter.endpos.y,
      },
      angle: this.emitter.angle,
    });
  }

  // Advance the bullet by one fixed step `dt` (seconds), sweeping continuously
  // against the walls and reflecting at every surface it crosses. The bullet
  // centre is integrated; `position` (top-left) is written back at the end.
  update(room: Room, dt: number): void {
    this.mytick++;

    const halfW = this.size.w / 2;
    const halfH = this.size.h / 2;
    const centre: Vec2 = {
      x: this.position.x + halfW,
      y: this.position.y + halfH,
    };
    resolveStartOverlap(centre, room.Bcollision, halfW, halfH);

    let remaining = 1; // fraction of this step's displacement left to travel
    let ignore: CollisionBox | null = null; // wall hit this step, skip next sweep

    for (
      let iter = 0;
      iter < MAX_BOUNCES_PER_STEP && remaining > 1e-6;
      iter++
    ) {
      const dx = this.velocity.x * dt * remaining;
      const dy = this.velocity.y * dt * remaining;

      const hit = sweepCentreVsWalls(
        centre.x,
        centre.y,
        dx,
        dy,
        room.Bcollision,
        halfW,
        halfH,
        ignore
      );

      if (hit === null) {
        centre.x += dx;
        centre.y += dy;
        remaining = 0;
        break;
      }

      centre.x = hit.x;
      centre.y = hit.y;
      this.reflect(room, hit, dx, dy);
      this.last_collision_object = hit.wall;
      ignore = hit.wall;

      // Nudge off the surface along the new heading so the next sweep starts
      // strictly outside this wall.
      const speed = Math.hypot(this.velocity.x, this.velocity.y) || 1;
      centre.x += (this.velocity.x / speed) * SKIN;
      centre.y += (this.velocity.y / speed) * SKIN;

      remaining *= 1 - hit.t;
    }

    this.position.x = centre.x - halfW;
    this.position.y = centre.y - halfH;
  }

  // Reflect the velocity across the hit surface, update the firing angle to
  // match, count the bounce and emit the ricochet spark (until max_bounce).
  private reflect(room: Room, hit: SweepHit, dx: number, dy: number): void {
    if (hit.horizontal) {
      this.velocity.y = -this.velocity.y;
      this.angle = -this.angle;
      this.side = dy < 0 ? "up" : "down";
    } else {
      this.velocity.x = -this.velocity.x;
      this.angle = Math.PI - this.angle;
      this.side = dx < 0 ? "left" : "right";
    }
    this.bounce += 1;
    room.sounds.ricochet = true;
    if (this.bounce < this.max_bounce) {
      room.emit_to_room("ricochet_explosion", {
        position: { x: hit.x, y: hit.y },
        angle: this.angle,
      });
    }
  }
}
