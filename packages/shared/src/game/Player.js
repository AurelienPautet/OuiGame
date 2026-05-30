import { rectRect, colliderect } from "./check_collision.js";
import { Bullet } from "./Bullet.js";
import { Mine } from "./Mine.js";
import { Stats } from "./Stats.js";

export class Player {
  constructor(position, socketid, name, turretc, bodyc) {
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
  spawn(spawn_pos) {
    console.log("Spawning player at", spawn_pos);
    this.alive = true;
    this.minecount = 0;
    this.bulletcount = 0;
    this.position = structuredClone(spawn_pos);
    this.spawnpos = spawn_pos;
  }
  shoot(room) {
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
  plant(room) {
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

  update(room, fps_corector) {
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
      this.BodyCollision(room.Bcollision[i]);
    }
    for (let socket_id in room.players) {
      if (room.players[socket_id].alive && this != room.players[socket_id]) {
        this.BodyCollision(room.players[socket_id]);
      }
    }
    for (let i = 0; i < room.holes.length; i++) {
      this.BodyCollision(room.holes[i]);
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
  endofbarrel() {
    this.endpos.x =
      this.position.x +
      this.size.w / 2 -
      (30 + this.bullet_size.w * 1) * Math.cos(this.angle);
    this.endpos.y =
      this.position.y +
      this.size.h / 2 -
      (30 + this.bullet_size.h * 1) * Math.sin(this.angle);
  }
  CalculateAngle() {
    try {
      let adjacent = this.aim.x - (this.position.x + this.size.w / 2);
      let opposite = this.aim.y - (this.position.y + this.size.h / 2);
      let angle = Math.atan(opposite / adjacent);
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
  BulletCollision(obj) {
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
  BodyCollision(obj) {
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
