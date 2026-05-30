try {
  ({
    rectanglesSeTouchent,
    rectRect,
    distance,
  } = require("../../shared/scripts/check_collision.js"));

  ({ generateBcollision } = require("../../shared/scripts/level_loader.js"));
  Player = require("../../shared/class/Player.js");
} catch (error) {
  console.error("Error requiring dependencies in Room.js:", error);
}

class Room {
  static next_id = 1;
  static bot_colors = {
    bot1: ["blue", "blue"],
    bot2: ["green", "green"],
    bot3: ["orange", "orange"],
    bot4: ["red", "red"],
  };

  static getNextId() {
    return Room.next_id++;
  }

  constructor(name, rounds, levels, creator, io = null, password = "") {
    this.id = Room.getNextId();
    this.password = password;
    this.io = io;
    this.name = name;
    this.waitingrespawn = false;
    this.atleast2 = false;
    this.maxplayernb = 0;
    this.levels = levels;
    this.rounds = rounds;
    this.creator = creator;
    this.sounds = {
      plant: false,
      kill: false,
      shoot: false,
      ricochet: false,
      explose: false,
    };
    this.levelid = 0;
    this.human_players = [];
    this.players = {};
    this.ids = [];
    this.ids_to_names = {};
    this.blocks = [];
    this.Bcollision = [];
    this.bullets = [];
    this.mines = [];
    this.holes = [];
    this.spawns = [];
    this.nbliving = 0;
    this.tick = 0;
    this.timetoeplode = 300;
    this.mines_explsion_radius = 90;
    this.waitingtime = 5000;
    this.fps_corector = 1;
    this.bot1_spawns = [];
    this.bot2_spawns = [];
    this.bot3_spawns = [];
    this.bot4_spawns = [];

    // Countdown state - when true, render but skip player input/actions
    this.countdownActive = false;
    this.countdownDuration = 3000; // 3 seconds
  }

  spawn_new_player(playerName, turretc, bodyc, socketid) {
    console.log(
      "Spawning new player:",
      playerName,
      "with socket ID:",
      socketid
    );

    let new_player = new Player(
      { x: 0, y: 0 },
      socketid,
      playerName,
      turretc,
      bodyc
    );
    this.spawn_new(new_player, socketid, this.spawns);
    this.human_players.push(socketid);
  }

  spawn_new(player, socket_id, spawns) {
    this.players[socket_id] = player;
    this.ids.push(socket_id);
    this.ids_to_names[socket_id] = player.name;
    this.spawn_player(player, spawns);
  }

  spawn_player(player, spawns) {
    let spawnid = Math.floor(Math.random() * spawns.length);
    //console.log("caca:", this.spawns, "at spawn id:", this.spawns[spawnid]);

    this.nbliving += 1;
    player.spawn(spawns[spawnid]);

    spawns.splice(spawnid, 1);
  }

  spawn_all_bots() {
    console.log(
      "Spawning bots in room:",
      this.bot1_spawns,
      this.bot1_spawns.length
    );
    let bot_index = 0;
    let number_to_spawn_1 = this.bot1_spawns.length;
    for (let i = 0; i < number_to_spawn_1; i++) {
      let bot = new Bot1(
        { x: 0, y: 0 },
        `bot${bot_index}`,
        `Bot1_ ${i}`,
        Room.bot_colors.bot1[0],
        Room.bot_colors.bot1[1]
      );
      this.spawn_new(bot, `bot${i}`, this.bot1_spawns);
      bot_index++;
    }
    let number_to_spawn_2 = this.bot2_spawns.length;
    for (let i = 0; i < number_to_spawn_2; i++) {
      let bot = new Bot2(
        { x: 0, y: 0 },
        `bot${bot_index}`,
        `Bot2_ ${i}`,
        Room.bot_colors.bot2[0],
        Room.bot_colors.bot2[1]
      );
      this.spawn_new(bot, `bot${bot_index}`, this.bot2_spawns);
      bot_index++;
    }
    let number_to_spawn_3 = this.bot3_spawns.length;
    for (let i = 0; i < number_to_spawn_3; i++) {
      let bot = new Bot3(
        { x: 0, y: 0 },
        `bot${bot_index}`,
        `Bot3_ ${i}`,
        Room.bot_colors.bot3[0],
        Room.bot_colors.bot3[1]
      );
      this.spawn_new(bot, `bot${bot_index}`, this.bot3_spawns);
      bot_index++;
    }
    let number_to_spawn_4 = this.bot4_spawns.length;
    for (let i = 0; i < number_to_spawn_4; i++) {
      let bot = new Bot4(
        { x: 0, y: 0 },
        `bot${bot_index}`,
        `Bot4_ ${i}`,
        "red",
        "red"
      );
      this.spawn_new(bot, `bot${bot_index}`, this.bot4_spawns);
      bot_index++;
    }
  }

  update(fps_corector, ctx, debug_visual) {
    this.sounds = {
      plant: false,
      kill: false,
      shoot: false,
      ricochet: false,
      explose: false,
    };
    this.tick++;
    this.fps_corector = fps_corector;
    //console.log("Updating room:", this.name, "tick:", this.tick);
    this.update_bullets();
    this.update_mines();

    // Only update player movements/actions if not in countdown
    if (!this.countdownActive) {
      this.update_players(ctx, debug_visual);
    }
    //console.log(this.players);
    this.emit_to_room("tick", {
      players: this.players,
      bullets: this.bullets,
      mines: this.mines,
      name: this.name,
      holes: this.holes,
      tick: this.tick,
    });
    this.emit_to_room("tick_sounds", this.sounds);

    return this.check_for_winns_and_load_next_level();
  }

  emit_to_room(string, data) {
    //console.log("caca", this.io);
    if (this.io != null) {
      this.io.to(this.id).emit(string, data);
    } else {
      //console.error("No io instance available to emit to this:", this.name);
    }
  }

  check_for_winns_and_load_next_level() {
    if (this.waitingrespawn == false && this.nbliving <= 1) {
      if (Object.keys(this.players).length >= 2) {
        if (this.nbliving == 1) {
          for (let socketid in this.players) {
            let player = this.players[socketid];
            if (player.alive) {
              player.round_stats.stats.wins++;
              this.emit_to_room("winner", {
                socketid: socketid,
                waitingtime: this.waitingtime,
                player_scores: this.get_all_player_stats(),
                ids_to_name: this.ids_to_names,
              });
            }
          }
        } else {
          this.emit_to_room("winner", {
            socketid: -1,
            waitingtime: this.waitingtime,
            player_scores: this.get_all_player_stats(),
            ids_to_name: this.ids_to_names,
          });
        }
        this.waitingrespawn = true;
        return true;
      }
    }
    return false;
  }

  delete_player(socketid) {
    if (this.players[socketid]) {
      let player = this.players[socketid];
      this.emit_to_room("player-disconnection", player.name);
      delete this.players[socketid];
      this.ids.splice(this.ids.indexOf(socketid), 1);
      delete this.ids_to_names[socketid];
      this.spawns.push(player.spawnpos);
      if (player.alive) {
        this.nbliving--;
      }
      if (this.nbliving <= 0) {
        this.respawn_the_room();
      }
    }
  }

  respawn_the_room() {
    this.bullets = [];
    this.mines = [];
    this.emit_to_room("level_change", {
      blocks: this.blocks,
      Bcollision: this.Bcollision,
      level_id: this.levels[this.levelid],
    });
    for (let socketid in this.players) {
      let player = this.players[socketid];
      this.spawn_player(player, this.spawns);
    }
    this.nbliving = Object.keys(this.players).length;
    this.waitingrespawn = false;

    if (this.levelid < this.levels.length - 1) {
      this.levelid++;
    } else {
      this.levelid = 0;
    }
  }

  update_players(ctx, debug_visual) {
    //console.log("Updating players in room:", this.players);
    for (let sckid in this.players) {
      this.players[sckid].update(this, this.fps_corector, ctx, debug_visual);
    }
  }

  update_bullets() {
    bulleting: for (let i = 0; i < this.bullets.length; i++) {
      this.bullets[i].update(this, this.fps_corector);
      if (this.bullets[i].bounce >= this.bullets[i].max_bounce) {
        this.emit_to_room("bullet_explosion", {
          position: {
            x: this.bullets[i].position.x,
            y: this.bullets[i].position.y,
          },
        });
        this.bullets[i].emitter.bulletcount--;
        this.bullets.splice(i, 1);
        i -= 1;
        continue bulleting;
      }
      for (let e = 0; e < this.mines.length; e++) {
        if (
          rectanglesSeTouchent(
            this.mines[e].position.x - this.mines[e].radius,
            this.mines[e].position.y - this.mines[e].radius,
            this.mines[e].radius * 2,
            this.mines[e].radius * 2,
            this.bullets[i].position.x,
            this.bullets[i].position.y,
            this.bullets[i].size.w,
            this.bullets[i].size.h
          )
        ) {
          this.mines[e].timealive = this.timetoeplode;
          this.bullets[i].emitter.bulletcount--;
          this.bullets[i].emitter.round_stats.stats.hits++;
          this.bullets.splice(i, 1);
          i -= 1;
          continue bulleting;
        }
      }
      for (let e = 0; e < this.bullets.length; e++) {
        if (
          rectRect(
            this.bullets[i].position.x,
            this.bullets[i].position.y,
            this.bullets[i].size.w,
            this.bullets[i].size.h,
            this.bullets[e].position.x,
            this.bullets[e].position.y,
            this.bullets[e].size.w,
            this.bullets[e].size.h
          ) &&
          i != e
        ) {
          this.bullets[i].emitter.bulletcount--;
          this.bullets[i].emitter.round_stats.stats.hits++;
          this.bullets[e].emitter.bulletcount--;
          this.bullets[e].emitter.round_stats.stats.hits++;
          this.emit_to_room("bullet_explosion", {
            position: {
              x: this.bullets[i].position.x,
              y: this.bullets[i].position.y,
            },
          });
          if (e < i) {
            this.bullets.splice(i, 1);
            this.bullets.splice(e, 1);
            i -= 2;
          } else {
            this.bullets.splice(e, 1);
            this.bullets.splice(i, 1);
            i -= 1;
          }

          continue bulleting;
        }
      }
      for (let socketid in this.players) {
        if (
          this.players[socketid].BulletCollision(this.bullets[i]) &&
          this.players[socketid].alive
        ) {
          this.bullets[i].emitter.bulletcount--;
          this.bullets[i].emitter.round_stats.stats.hits++;

          this.kill(this.bullets[i].emitter, this.players[socketid], "bullet");
          this.bullets.splice(i, 1);
          i -= 1;

          continue bulleting;
        }
      }
    }
  }
  update_mines() {
    //update the mines
    mining: for (let i = 0; i < this.mines.length; i++) {
      this.mines[i].update(this.fps_corector);
      if (this.mines[i].timealive > this.timetoeplode) {
        for (let m = 0; m < this.blocks.length; m++) {
          if (this.blocks[m].type == 2) {
            if (
              distance(
                this.mines[i].position,
                { w: this.mines[i].radius * 2, h: this.mines[i].radius * 2 },
                this.blocks[m].position,
                this.blocks[m].size
              ) <=
              this.mines_explsion_radius ** 2
            ) {
              this.mines[i].emitter.round_stats.stats.blocks_destroyed++;
              this.blocklist[
                (this.blocks[m].position.y / 50) * 23 +
                  this.blocks[m].position.x / 50
              ] = 10;
              generateBcollision(this);
              this.blocks.splice(m, 1);
              this.emit_to_room("level_change", {
                blocks: this.blocks,
                Bcollision: this.Bcollision,
                level_id: this.levels[this.levelid],
              });

              m -= 1;
            }
          }
        }
        for (let e = 0; e < this.mines.length; e++) {
          if (
            distance(
              this.mines[i].position,
              { w: this.mines[i].radius * 2, h: this.mines[i].radius * 2 },
              this.mines[e].position,
              { w: this.mines[e].radius * 2, h: this.mines[e].radius * 2 }
            ) <=
            this.mines_explsion_radius ** 2
          ) {
            this.mines[e].timealive = this.timetoeplode;
          }
        }
        for (let socketid in this.players) {
          if (
            distance(
              this.mines[i].position,
              { w: this.mines[i].radius * 2, h: this.mines[i].radius * 2 },
              this.players[socketid].position,
              this.players[socketid].size
            ) <=
              this.mines_explsion_radius ** 2 &&
            this.players[socketid].alive
          ) {
            this.kill(this.mines[i].emitter, this.players[socketid], "mine");
          }
        }

        this.emit_to_room("mine_explosion", {
          position: {
            x: this.mines[i].position.x + this.mines[i].radius / 2,
            y: this.mines[i].position.y + this.mines[i].radius / 2,
          },
        });
        this.sounds.explose = true;
        this.mines[i].emitter.minecount--;
        this.mines.splice(i, 1);
        i -= 1;
        continue mining;
      }
    }
  }
  kill(killer, killed, type) {
    killed.alive = false;
    killer.round_stats.stats.kills++;
    killed.round_stats.stats.deaths++;
    this.nbliving--;
    this.sounds.kill = true;
    this.emit_to_room("player-kill", {
      players: [killer.name, killed.name],
      type: type,
    });
    this.emit_to_room("player_explosion", {
      position: {
        x: killed.position.x + killed.size.w / 2,
        y: killed.position.y + killed.size.h / 2,
      },
    });
  }

  get_all_player_stats() {
    let stats = {};
    for (let socketid in this.players) {
      let player = this.players[socketid];
      stats[socketid] = player.round_stats.stats;
    }
    return stats;
  }
}

try {
  module.exports = Room;
} catch (error) {
  console.error("Error exporting Room class:", error);
}
