import { rectRect, colliderect } from "./check_collision.js";
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
      w: 45,
      h: 45,
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
    this.mvtspeed = 3;
    this.shoot_speed = 5;
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
    fps_corector: number,
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
    for (let i = 0; i < room.Bcollision.length; i++) {
      this.BodyCollision(room.Bcollision[i]!);
    }
    for (const socket_id in room.players) {
      const other = room.players[socket_id];
      if (other && other.alive && this != other) {
        this.BodyCollision(other);
      }
    }
    for (let i = 0; i < room.holes.length; i++) {
      this.BodyCollision(room.holes[i]!);
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
      this.position.x += this.velocity.x * fps_corector;
      this.position.y += this.velocity.y * fps_corector;
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
    }
  }
  endofbarrel(): void {
    this.endpos.x =
      this.position.x +
      this.size.w / 2 -
      (30 + this.bullet_size.w * 1) * Math.cos(this.angle);
    this.endpos.y =
      this.position.y +
      this.size.h / 2 -
      (30 + this.bullet_size.h * 1) * Math.sin(this.angle);
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
  BulletCollision(obj: Collidable): string | boolean {
    if (this.position == undefined) {
      //console.error("Player position is undefined, cannot check bullet collision.");
      return false;
    }
    return (this.side = rectRect(
      this.position.y,
      this.position.x,
      this.size.w,
      this.size.h,
      obj.position.y,
      obj.position.x,
      obj.size.w,
      obj.size.h
    ));
  }
  BodyCollision(obj: Collidable): void {
    this.side = colliderect(
      this.position.y,
      this.position.x,
      this.size.w,
      this.size.h,
      obj.position.y,
      obj.position.x,
      obj.size.w,
      obj.size.h,
      3
    );
    if (this.side == "right") {
      if (this.velocity.x > 0) this.velocity.x = 0;
    }
    if (this.side == "left") {
      if (this.velocity.x < 0) this.velocity.x = 0;
    }
    if (this.side == "up") {
      if (this.velocity.y < 0) this.velocity.y = 0;
    }
    if (this.side == "down") {
      if (this.velocity.y > 0) this.velocity.y = 0;
    }
  }
}
