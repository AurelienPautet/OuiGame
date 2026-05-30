import { rectRect2 } from "./possible_shots_balls.js";

class possible_moves {
  constructor(position, size, bot, direction) {
    this.position = { x: position.x, y: position.y };
    this.size = size;
    this.bot = bot;
    this.direction = direction;
    this.should_go = false;

    this.bullet = direction.includes("bullet");
    this.wall = direction.includes("wall");
    this.mine = direction.includes("mine");
  }

  update_state(room, ctx, debug_visual) {
    if (this.bullet) {
      for (let i = 0; i < room.bullets.length; i++) {
        if (this.should_go) {
          continue; // If already set to go, skip further checks
        }
        const bullet = room.bullets[i];
        if (bullet.emitter === this.bot && bullet.mytick < 15) {
          continue; // Skip if the bullet is emitted by the same bot
        }
        if (
          rectRect2(
            this.position.x,
            this.position.y,
            this.size.w,
            this.size.h,
            bullet.position.x,
            bullet.position.y,
            bullet.size.w,
            bullet.size.h
          )
        ) {
          this.should_go = true;
        }
      }
      if (this.should_go) {
        if (this.direction.includes("right")) {
          this.bot.should_go_to.right = this.should_go;
        }
        if (this.direction.includes("up")) {
          this.bot.should_go_to.up = this.should_go;
        }
        if (this.direction.includes("down")) {
          this.bot.should_go_to.down = this.should_go;
        }
        if (this.direction.includes("left")) {
          this.bot.should_go_to.left = this.should_go;
        }
      }
    }
    if (this.wall) {
      for (let i = 0; i < room.Bcollision.length; i++) {
        const block = room.Bcollision[i];
        if (
          rectRect2(
            this.position.x,
            this.position.y,
            this.size.w,
            this.size.h,
            block.position.x,
            block.position.y,
            block.size.w,
            block.size.h
          )
        ) {
          this.should_go = true;
        }
      }
      if (this.should_go) {
        if (this.direction.includes("right")) {
          this.bot.wall_go_to.right = this.should_go;
        }
        if (this.direction.includes("up")) {
          this.bot.wall_go_to.up = this.should_go;
        }
        if (this.direction.includes("down")) {
          this.bot.wall_go_to.down = this.should_go;
        }
        if (this.direction.includes("left")) {
          this.bot.wall_go_to.left = this.should_go;
        }
      }
    }

    if (this.mine) {
      for (let i = 0; i < room.mines.length; i++) {
        const mine = room.mines[i];
        if (
          rectRect2(
            this.position.x,
            this.position.y,
            this.size.w,
            this.size.h,
            mine.position.x - mine.radius,
            mine.position.y - mine.radius,
            mine.radius * 2,
            mine.radius * 2
          )
        ) {
          this.should_go = true;
        }
      }
      if (this.should_go) {
        this.bot.mine_go_to = this.should_go;
      }
    }
    this.draw(ctx, debug_visual);
  }

  draw(ctx, debug_visual) {
    if (!ctx) return; // headless / no canvas: the bot math already ran above
    let color = "black";
    ctx.globalAlpha = 0.5;
    if (this.bullet) {
      color = "green";
    } else if (this.wall) {
      color = "blue";
    }
    if (this.should_go) {
      color = "red";
    }
    if (debug_visual) {
      ctx.fillStyle = color;
      ctx.fillRect(this.position.x, this.position.y, this.size.w, this.size.h);
    }
    ctx.globalAlpha = 1;
  }
}

export function launch_possible_moves(size, bot, room, ctx, debug_visual) {
  new possible_moves(
    {
      x: bot.position.x + bot.size.w / 2 - 160,
      y: bot.position.y + bot.size.h / 2 - 160,
    },
    { w: 320, h: 320 },
    bot,
    "mine"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x + bot.size.w,
      y: bot.position.y + 4,
    },
    { w: size.w * 1.3, h: size.h - 4 * 2 },
    bot,
    "wall left"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x - size.w * 1.3,
      y: bot.position.y + 4,
    },
    { w: size.w * 1.3, h: size.h - 4 * 2 },
    bot,
    "wall right"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x + 4,
      y: bot.position.y - size.h * 1.3,
    },
    { w: size.w - 4 * 2, h: size.h * 1.3 },
    bot,
    "wall down"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x + 4,
      y: bot.position.y + bot.size.h,
    },
    { w: size.w - 4 * 2, h: size.h * 1.3 },
    bot,
    "wall up"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x + bot.size.w,
      y: bot.position.y,
    },
    size,
    bot,
    "bullet left"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x - size.w,
      y: bot.position.y,
    },
    size,
    bot,
    "bullet right"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x,
      y: bot.position.y - size.h,
    },
    size,
    bot,
    "bullet down"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x,
      y: bot.position.y + bot.size.h,
    },
    size,
    bot,
    "bullet up"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x - bot.size.w / 2 - bot.size.w / 2,
      y: bot.position.y - bot.size.h / 2 - bot.size.h / 2,
    },
    size,
    bot,
    "bullet down right"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x + bot.size.w * 1.5 - bot.size.w / 2,
      y: bot.position.y - bot.size.h / 2 - bot.size.h / 2,
    },
    size,
    bot,
    "bullet down left"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x + bot.size.w * 1.5 - bot.size.w / 2,
      y: bot.position.y + bot.size.h * 1.5 - bot.size.h / 2,
    },
    size,
    bot,
    "bullet up left"
  ).update_state(room, ctx, debug_visual);
  new possible_moves(
    {
      x: bot.position.x - bot.size.w / 2 - bot.size.w / 2,
      y: bot.position.y + bot.size.h * 1.5 - bot.size.h / 2,
    },
    size,
    bot,
    "bullet up right"
  ).update_state(room, ctx, debug_visual);
}
