import type { Vec2, DrawingContext } from "./types.js";
import type { Bot } from "./Bot.js";
import type { Room } from "./Room.js";

// What a bot's raycast pass is allowed to consider, and whether to draw it.
interface ShotData {
  bullets: boolean;
  debug: boolean;
}

class possible_shot_points {
  room: Room;
  ctx: DrawingContext | undefined;
  initial_player: Bot;
  initial_position: Vec2;
  radius: number;
  initial_angle: number;
  position: Vec2;
  direction: Vec2;
  angle: number;
  bounce: number;
  first_bounce_pos: Vec2;
  step_size: number;
  calls: number;
  data: ShotData;

  constructor(
    initial_position: Vec2,
    initial_angle: number,
    step_size: number,
    radius: number,
    initial_player: Bot,
    data: ShotData,
    room: Room,
    ctx?: DrawingContext
  ) {
    this.room = room;
    this.ctx = ctx;
    this.initial_player = initial_player;
    this.initial_position = {
      x: initial_position.x + initial_player.size.w / 2,
      y: initial_position.y + initial_player.size.h / 2,
    };
    this.radius = radius;
    this.initial_angle = initial_angle;
    this.position = {
      x: initial_position.x + 40 * Math.cos(initial_angle),
      y: initial_position.y + 40 * Math.sin(initial_angle),
    };
    this.direction = {
      x: Math.cos(initial_angle),
      y: Math.sin(initial_angle),
    };
    this.angle = initial_angle;
    this.bounce = 0;
    this.first_bounce_pos = { x: 0, y: 0 };
    this.step_size = step_size;
    this.calls = 0;
    this.data = data;
  }

  update_repeat(N: number): void {
    for (let i = 0; i < N; i++) {
      if (this.bounce >= this.initial_player.shoot_max_bounce) {
        break;
      }
      if (i % 2 == 0) {
        this.draw("red");
      }
      this.update_position();
    }
  }

  update_position(): void {
    let socketid: string;

    this.calls++;

    if (this.bounce >= this.initial_player.shoot_max_bounce) {
      return;
    }

    this.position = {
      x: this.position.x + this.step_size * this.direction.x,
      y: this.position.y + this.step_size * this.direction.y,
    };

    const numMines = this.room.mines.length;
    for (let i = 0; i < numMines; i++) {
      const mine = this.room.mines[i]!;
      if (
        rectRect2(
          this.position.x,
          this.position.y,
          this.radius * 2,
          this.radius * 2,
          mine.position.x - mine.radius,
          mine.position.y - mine.radius,
          mine.radius * 2,
          mine.radius * 2
        )
      ) {
        this.bounce = 100;
        this.draw("yellow");

        return;
      }
    }
    if (this.data.bullets) {
      for (let i = 0; i < this.room.bullets.length; i++) {
        const bullet = this.room.bullets[i]!;
        if (
          rectRect2(
            this.position.x,
            this.position.y,
            this.radius * 2,
            this.radius * 2,
            bullet.position.x,
            bullet.position.y,
            bullet.size.w,
            bullet.size.h
          )
        ) {
          /*         if (this.bounce == 0 && this.calls < 50 && bullet.mytick > 30) {
          this.initial_player.killing_aims.push({
            angle: this.initial_angle % (Math.PI * 2),
            distance: this.calls * 3,
          });
        } */
          this.draw("blue");
          this.bounce = 100;

          /*         this.bounce = 4;
        return; */
        }
      }
    }
    for (socketid in this.room.players) {
      const player = this.room.players[socketid];
      if (!player || !player.alive) {
        continue;
      }
      if (socketid === this.initial_player.socketid && this.calls < 7) {
        continue;
      }
      if (socketid.includes("bot")) {
        if (
          rectRect2(
            this.position.x,
            this.position.y,
            this.radius * 2,
            this.radius * 2,
            player.position.x,
            player.position.y,
            player.size.w,
            player.size.h
          )
        ) {
          this.bounce = 100;
          this.draw("orange");
          return;
        }
      }
      if (
        player.alive &&
        rectRect2(
          this.position.x,
          this.position.y,
          this.radius * 2,
          this.radius * 2,
          player.position.x,
          player.position.y,
          player.size.w,
          player.size.h
        )
      ) {
        this.draw("green");
        /*         console.log(
          "possible shot found",
          this.calls,
          "at",
          this.first_bounce_pos,
          "bounce",
          this.bounce
        ); */
        this.bounce = 100;

        this.initial_player.killing_aims.push({
          angle: this.initial_angle % (Math.PI * 2),
          distance: this.calls,
        });

        return;
      }
    }
    let res = "";
    const numBlocks = this.room.Bcollision.length;
    for (let e = 0; e < numBlocks; e++) {
      const block = this.room.Bcollision[e]!;
      res = detectCollisions2(
        block.position.x,
        block.position.y,
        block.size.w,
        block.size.h,
        this.position.x - this.radius,
        this.position.y - this.radius,
        this.radius * 2,
        this.radius * 2
      );
      if (res === "left") {
        this.angle = Math.PI - this.angle;
        this.direction = {
          x: Math.cos(this.angle),
          y: Math.sin(this.angle),
        };
        this.bounce++;
        break;
      } else if (res === "right") {
        this.angle = Math.PI - this.angle;
        this.bounce++;
        this.direction = {
          x: Math.cos(this.angle),
          y: Math.sin(this.angle),
        };
        break;
      } else if (res === "top") {
        this.angle = -this.angle;
        this.bounce++;
        this.direction = {
          x: Math.cos(this.angle),
          y: Math.sin(this.angle),
        };
        break;
      } else if (res === "bottom") {
        this.angle = -this.angle;
        this.bounce++;
        this.direction = {
          x: Math.cos(this.angle),
          y: Math.sin(this.angle),
        };
        break;
      }
    }
  }
  draw(color: string): void {
    /*     c.save();
    c.globalAlpha = 0.3;
    c.beginPath();
    c.arc(
      this.initial_player.position.x + this.initial_player.size.w / 2,
      this.initial_player.position.y + this.initial_player.size.h / 2,
      this.initial_player.size.w / 2,
      0,
      2 * Math.PI
    );
    c.fillStyle = color;
    c.fill();
    c.closePath();
    c.restore(); */
    if (this.data.debug && this.ctx) {
      const ctx = this.ctx;
      ctx.globalAlpha = 0.03;

      ctx.beginPath();
      ctx.arc(this.position.x, this.position.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.closePath();
      ctx.globalAlpha = 1;
    }
  }
}

export function launch_possible_shots(
  N: number,
  step_size: number,
  radius: number,
  bot: Bot,
  data: ShotData,
  room: Room,
  ctx?: DrawingContext
): void {
  for (let i = 0; i < N; i++) {
    const angle = (i * Math.PI * 2) / N;

    const shot = new possible_shot_points(
      {
        x: bot.position.x + bot.size.w / 2,
        y: bot.position.y + bot.size.h / 2,
      },
      angle,
      step_size,
      radius,
      bot,
      data,
      room,
      ctx
    );
    shot.update_repeat(10000);
  }
}

export function rectRect2(
  r1x: number,
  r1y: number,
  r1w: number,
  r1h: number,
  r2x: number,
  r2y: number,
  r2w: number,
  r2h: number
): boolean {
  if (
    r1x + r1w >= r2x &&
    r1x <= r2x + r2w &&
    r1y + r1h >= r2y &&
    r1y <= r2y + r2h
  ) {
    return true;
  }
  return false;
}

function detectCollisions2(
  r1x: number,
  r1y: number,
  r1w: number,
  r1h: number,
  r2x: number,
  r2y: number,
  r2w: number,
  r2h: number
): string {
  if (
    r1x + r1w >= r2x &&
    r1x <= r2x + r2w &&
    r1y + r1h >= r2y &&
    r1y <= r2y + r2h
  ) {
    const overlapLeft = r1x + r1w - r2x;
    const overlapRight = r2x + r2w - r1x;
    const overlapTop = r1y + r1h - r2y;
    const overlapBottom = r2y + r2h - r1y;

    const minOverlap = Math.min(
      overlapLeft,
      overlapRight,
      overlapTop,
      overlapBottom
    );

    if (minOverlap === overlapLeft) return "left";
    if (minOverlap === overlapRight) return "right";
    if (minOverlap === overlapTop) return "top";
    if (minOverlap === overlapBottom) return "bottom";
  }
  return "";
}
