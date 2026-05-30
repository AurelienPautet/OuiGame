import { detectCollision } from "./check_collision.js";

export class Bullet {
  constructor(position, angle, speed, size, max_bounce, type, emitter, room) {
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
  update(room, fps_corector) {
    this.mytick++;
    for (let i = 0; i < room.Bcollision.length; i++) {
      this.collision_walls(room.Bcollision[i], room);
    }
    this.position.x += this.velocity.x * fps_corector;
    this.position.y += this.velocity.y * fps_corector;
  }
  collision_walls(obj, room) {
    /*this.side = colliderect(
      this.position.y + 2 * this.velocity.y,
      this.position.x + 2 * this.velocity.x,
      this.size.w,
      this.size.h,
      obj.position.y,
      obj.position.x,
      obj.size.w,
      obj.size.h,
      0
    );*/
    if (this.last_collision_object == obj) {
      return;
    }

    this.side = detectCollision(this, obj, { x: 2, y: 2 });
    if (this.side != "") {
      room.sounds.ricochet = true;
      this.last_collision_object = obj;
      this.bounce += 1;
    }
    if (this.side == "right") {
      this.velocity.x = -this.velocity.x;
      this.angle = Math.PI - this.angle;
      if (this.bounce < this.max_bounce) {
        room.emit_to_room("ricochet_explosion", {
          position: {
            x: this.position.x + this.size.w,
            y: this.position.y,
          },
          angle: this.angle,
        });
      }
    } else if (this.side == "left") {
      this.velocity.x = -this.velocity.x;
      this.angle = Math.PI - this.angle;
      if (this.bounce < this.max_bounce) {
        room.emit_to_room("ricochet_explosion", {
          position: {
            x: this.position.x,
            y: this.position.y,
          },
          angle: this.angle,
        });
      }
    } else if (this.side == "up") {
      this.velocity.y = -this.velocity.y;
      this.angle = -this.angle;
      if (this.bounce < this.max_bounce) {
        room.emit_to_room("ricochet_explosion", {
          position: {
            x: this.position.x,
            y: this.position.y,
          },
          angle: this.angle,
        });
      }
    } else if (this.side == "down") {
      this.velocity.y = -this.velocity.y;
      this.angle = -this.angle;
      if (this.bounce < this.max_bounce) {
        room.emit_to_room("ricochet_explosion", {
          position: {
            x: this.position.x,
            y: this.position.y + this.size.h,
          },
          angle: this.angle,
        });
      }
    }
  }
}
