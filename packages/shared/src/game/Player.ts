import {
  circlesOverlap,
  resolveCircleRect,
  resolveCircleCircle,
  TANK_HULL_RADIUS_FACTOR,
} from "./check_collision.js";
import { BARREL_LENGTH, TANK_SIZE } from "./game_constants.js";
import { Bullet } from "./Bullet.js";
import { Mine } from "./Mine.js";
import { Stats } from "./Stats.js";
import type { Vec2, Size, DrawingContext } from "./types.js";
import type { Room } from "./Room.js";

// The minimal box shape the collision helpers read off a collidable. Blocks,
// holes, bullets and other players all satisfy it.
interface Collidable {
  position: Vec2;
  size: Size;
}

export class Player {
  name: string;
  bodyc: string;
  turretc: string;
  position: Vec2;
  socketid: string;
  mytick: number;
  round_stats: Stats;
  spawnpos: Vec2;
  velocity: Vec2;
  size: Size;
  turretsize: Size;
  angle: number;
  endpos: Vec2;
  direction: Vec2;
  bulletcount: number;
  minecount: number;
  aim: Vec2;
  alive: boolean;
  max_bulletcount: number;
  max_minecount: number;
  mvtspeed: number;
  shoot_speed: number;
  shoot_max_bounce: number;
  bullet_size: Size;
  bullet_type: number;
  // Added at runtime by update()/the collision checks.
  rotation?: number;
  side?: string | boolean;

  constructor(
    position: Vec2,
    socketid: string,
    name: string,
    turretc: string,
    bodyc: string
  ) {
    this.name = name;
    this.bodyc = bodyc;
    this.turretc = turretc;
    this.position = position;
    this.socketid = socketid;
    this.mytick = 0;
    this.round_stats = new Stats();
    this.spawnpos = {
      x: 0,
      y: 0,
    };
    this.velocity = {
      x: 0,
      y: 0,
    };
    this.size = {
      w: TANK_SIZE,
      h: TANK_SIZE,
    };
    this.turretsize = {
      w: 60,
      h: 33,
    };
    this.angle = 0;
    this.endpos = {
      x: 0,
      y: 0,
    };
    this.direction = {
      x: 0,
      y: 0,
    };
    this.bulletcount = 0;
    this.minecount = 0;
    this.aim = {
      x: 0,
      y: 0,
    };
    this.alive = true;
    this.max_bulletcount = 5;
    this.max_minecount = 3;
    // Speeds are in px/second (integrated as `velocity * dt`). 180 px/s and
    // 300 px/s reproduce the historical 3 px and 5 px per 60 Hz step.
    this.mvtspeed = 180;
    this.shoot_speed = 300;
    this.shoot_max_bounce = 3;
    this.bullet_size = {
      w: 15,
      h: 15,
    };
    this.bullet_type = 1;
  }
  spawn(spawn_pos: Vec2): void {
    console.log("Spawning player at", spawn_pos);
    this.alive = true;
    this.minecount = 0;
    this.bulletcount = 0;
    this.position = structuredClone(spawn_pos);
    this.spawnpos = spawn_pos;
  }
  shoot(room: Room): void {
    this.endofbarrel();
    if (this.bulletcount < this.max_bulletcount && this.alive) {
      new Bullet(
        { x: this.endpos.x, y: this.endpos.y },
        this.angle,
        this.shoot_speed,
        this.bullet_size,
        this.shoot_max_bounce,
        this.bullet_type,

        this,
        room
      );
    }
  }
  plant(room: Room): void {
    if (this.minecount < this.max_minecount && this.alive) {
      new Mine(
        {
          x: this.position.x + this.size.w / 2,
          y: this.position.y + this.size.h / 2,
        },
        this,
        room
      );
    }
  }

  // ctx/debug_visual are unused by a human player; they exist so the signature
  // matches Bot.update (the same `players` map holds both) and Room.update_players.
  update(
    room: Room,
    dt: number,
    _ctx?: DrawingContext,
    _debug_visual?: boolean
  ): void {
    if (this.position == undefined) {
      //console.error("Player position is undefined, cannot update.");
      return;
    }
    this.CalculateAngle();
    //this.alive = true;

    this.mytick++;
    //change the angle of the image depending on the mvt direction
    if (this.alive) {
      if (this.direction.x > 0) {
        this.velocity.x = this.mvtspeed;
      } else if (this.direction.x < 0) {
        this.velocity.x = -this.mvtspeed;
      } else {
        this.velocity.x = 0;
      }
      if (this.direction.y > 0) {
        this.velocity.y = this.mvtspeed;
      } else if (this.direction.y < 0) {
        this.velocity.y = -this.mvtspeed;
      } else {
        this.velocity.y = 0;
      }
    }
    if (this.velocity.x > 0) {
      this.rotation = 0;
    } else if (this.velocity.x < 0) {
      this.rotation = 0;
    } else if (this.velocity.y < 0) {
      this.rotation = 90;
    } else if (this.velocity.y > 0) {
      this.rotation = 90;
    }
    if (this.velocity.x < 0 && this.velocity.y < 0) {
      this.rotation = 45;
    } else if (this.velocity.x > 0 && this.velocity.y < 0) {
      this.rotation = -45;
    } else if (this.velocity.x > 0 && this.velocity.y > 0) {
      this.rotation = 45;
    } else if (this.velocity.x < 0 && this.velocity.y > 0) {
      this.rotation = -45;
    }

    //handle the movement

    if (this.velocity.x != 0 && this.velocity.y != 0) {
      this.velocity.x = this.velocity.x / Math.sqrt(2);
      this.velocity.y = this.velocity.y / Math.sqrt(2);
    }
    if (this.alive) {
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;
      if (this.position.x < 0 + 50) {
        this.position.x = 0 + 50;
      }
      if (this.position.y < 0 + 50) {
        this.position.y = 0 + 50;
      }
      if (this.position.x + this.size.w > 50 * 22) {
        this.position.x = 50 * 22 - this.size.w;
      }
      if (this.position.y + this.size.h > 50 * 16) {
        this.position.y = 50 * 16 - this.size.h;
      }
      // The tank is a circle: after moving, eject it out of anything its hull
      // overlaps. Other tanks (circle vs circle) first, then holes and walls
      // (circle vs rect) — walls last so a tank shoved by another body can never
      // come to rest inside geometry. Movement that grazes a wall keeps its
      // tangential component, so the tank slides smoothly along it.
      this.resolveCollisions(room);
    }
  }
  endofbarrel(): void {
    this.endpos.x =
      this.position.x +
      this.size.w / 2 -
      (BARREL_LENGTH + this.bullet_size.w * 1) * Math.cos(this.angle);
    this.endpos.y =
      this.position.y +
      this.size.h / 2 -
      (BARREL_LENGTH + this.bullet_size.h * 1) * Math.sin(this.angle);
  }
  CalculateAngle(): void {
    try {
      const adjacent = this.aim.x - (this.position.x + this.size.w / 2);
      const opposite = this.aim.y - (this.position.y + this.size.h / 2);
      const angle = Math.atan(opposite / adjacent);
      if (adjacent < 0) {
        this.angle = angle;
      } else {
        this.angle = angle + Math.PI;
      }
    } catch (e) {
      console.error("Error calculating angle:", e);
      this.angle = 0; // Fallback to a default value
    }
  }
  // The tank's collision radius: the circular hull the renderer draws, so the
  // hitbox matches the on-screen tank exactly (no invisible box corners).
  collisionRadius(): number {
    return Math.min(this.size.w, this.size.h) * TANK_HULL_RADIUS_FACTOR;
  }

  // Does an incoming bullet's disc touch this tank's hull? `obj` is the bullet's
  // box (top-left position + size); both are reduced to circles about their box
  // centres. `side` is kept as a plain boolean hit flag for the tick snapshot.
  BulletCollision(obj: Collidable): boolean {
    if (this.position == undefined) {
      //console.error("Player position is undefined, cannot check bullet collision.");
      return false;
    }
    const bulletRadius = Math.min(obj.size.w, obj.size.h) / 2;
    return (this.side = circlesOverlap(
      this.position.x + this.size.w / 2,
      this.position.y + this.size.h / 2,
      this.collisionRadius(),
      obj.position.x + obj.size.w / 2,
      obj.position.y + obj.size.h / 2,
      bulletRadius
    ));
  }

  // Eject the tank's hull out of every body it overlaps after moving: other
  // tanks (circle vs circle), then holes and walls (circle vs rect, resolved
  // last so a shoved tank never rests inside geometry).
  resolveCollisions(room: Room): void {
    const r = this.collisionRadius();
    for (const socket_id in room.players) {
      const other = room.players[socket_id];
      if (!other || other === this || !other.alive) continue;
      const fixed = resolveCircleCircle(
        this.position.x + this.size.w / 2,
        this.position.y + this.size.h / 2,
        r,
        other.position.x + other.size.w / 2,
        other.position.y + other.size.h / 2,
        other.collisionRadius()
      );
      if (fixed) {
        this.position.x = fixed.x - this.size.w / 2;
        this.position.y = fixed.y - this.size.h / 2;
      }
    }
    this.resolveRectObstacles(room.holes);
    this.resolveRectObstacles(room.Bcollision);
  }

  // Push the tank's hull out of any axis-aligned obstacle (wall tile or hole) it
  // overlaps, along the minimum-translation contact normal. With the fixed
  // timestep keeping each step's displacement well under a tile, this guarantees
  // a tank can never settle inside or tunnel through geometry.
  private resolveRectObstacles(obstacles: Collidable[]): void {
    const r = this.collisionRadius();
    for (const o of obstacles) {
      const fixed = resolveCircleRect(
        this.position.x + this.size.w / 2,
        this.position.y + this.size.h / 2,
        r,
        o.position.x,
        o.position.y,
        o.size.w,
        o.size.h
      );
      if (fixed) {
        this.position.x = fixed.x - this.size.w / 2;
        this.position.y = fixed.y - this.size.h / 2;
      }
    }
  }
}
