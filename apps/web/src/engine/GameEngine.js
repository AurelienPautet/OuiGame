/**
 * GameEngine - Main game loop manager supporting both solo and online modes
 *
 * Solo: Local Room simulation with 60fps loop
 * Online: Listens to server 'tick' events, sends input via 'tock'
 *
 * Note: This relies on Shared classes being loaded via script tags (Room, Player, etc.)
 * which expose them as window globals - same as the original game.
 */
import { Renderer } from "./Renderer.js";
import { InputHandler } from "./InputHandler.js";
import { ParticleSystem } from "./ParticleSystem.js";
import { SoundManager } from "./SoundManager.js";

// LocalIO class for solo mode - forwards events to particle/sound systems
class LocalIO {
  constructor(particles, sounds) {
    this.particles = particles;
    this.sounds = sounds;
  }

  emit(event, data) {
    // Handle particle events
    switch (event) {
      case "ricochet_explosion":
        this.particles.ricochetSparks(data.position, data.angle, 20);
        break;
      case "bullet_explosion":
        this.particles.bulletExplosion(data.position, 100);
        break;
      case "shoot_explosion":
        this.particles.shootExplosion(data.position, data.angle, 30);
        break;
      case "player_explosion":
        this.particles.explosion(data.position, 100);
        break;
      case "mine_explosion":
        this.particles.explosion(data.position, 100);
        break;
      case "tick_sounds":
        this.sounds.playSounds(data);
        break;
    }
  }

  to() {
    return this; // Allow chaining: io.to(roomId).emit(...)
  }

  on() {}
  off() {}
}

export class GameEngine {
  constructor(canvas, fadingCanvas, socket) {
    this.canvas = canvas;
    this.socket = socket;
    this.mode = null; // 'solo' | 'online'

    // Systems
    this.renderer = new Renderer(canvas, fadingCanvas);
    this.input = new InputHandler(canvas);
    this.particles = new ParticleSystem();
    this.sounds = new SoundManager();

    // Game state
    this.running = false;
    this.paused = false;
    this.inCountdown = false; // When true, render but ignore input
    this.loopId = null;
    this.animationId = null;

    // Timing
    this.oldTime = performance.now();
    this.fpsCorrector = 1;
    this.tick = 0;

    // Solo mode state
    this.localRoom = null;
    this.mysocketid = null;
    this.gameOverTriggered = false;
    this.startTime = 0;
    this.initialBotCount = 0;
    this.onGameOver = null;

    // Online mode state
    this.roomId = null;
    this.serverId = null;
    this.playerId = null;

    // Game entities (received from server in online mode)
    this.players = {};
    this.blocks = [];
    this.Bcollision = [];
    this.bullets = [];
    this.mines = [];
    this.holes = [];

    // Callbacks
    this.onPause = null;
    this.onQuit = null;
    this.onCountdownStart = null; // Called when countdown should begin

    // Bind methods
    this._renderLoop = this._renderLoop.bind(this);
    this._onTick = this._onTick.bind(this);
    this._onLevelChange = this._onLevelChange.bind(this);

    // Set up particle socket listeners
    this._setupParticleListeners();
  }

  _setupParticleListeners() {
    if (!this.socket) return;

    this.socket.on("ricochet_explosion", (data) => {
      this.particles.ricochetSparks(data.position, data.angle, 20);
    });

    this.socket.on("bullet_explosion", (data) => {
      this.particles.bulletExplosion(data.position, 100);
    });

    this.socket.on("shoot_explosion", (data) => {
      this.particles.shootExplosion(data.position, data.angle, 30);
    });

    this.socket.on("player_explosion", (data) => {
      this.particles.explosion(data.position, 100);
    });

    this.socket.on("mine_explosion", (data) => {
      this.particles.explosion(data.position, 100);
    });

    this.socket.on("tick_sounds", (sounds) => {
      this.sounds.playSounds(sounds);
    });
  }

  async startSolo(levelId, playerName, tankColors) {
    this.mode = "solo";
    this.running = true;
    this.paused = false;

    // Generate a fake socket ID for solo mode
    this.mysocketid = "solo_player_" + Math.random().toString(36).substr(2, 9);
    this.startTime = performance.now();
    this.gameOverTriggered = false;

    // Check if Room class is available globally (loaded via script tag)
    if (typeof Room === "undefined") {
      console.error(
        "Room class not loaded. Make sure Shared scripts are included."
      );
      throw new Error("Room class not available");
    }

    // Request level data from server
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("No socket connection"));
        return;
      }

      this.socket.emit("get_json_from_id", levelId);

      this.socket.once("recieve_json_from_id", async (levelJson) => {
        try {
          // levelJson now contains { data: [...], level_name, level_creator_name, level_img }
          // Store full object as metadata for end screen
          this.levelMetadata = levelJson;

          // Extract the actual level data array for loading
          const levelData = levelJson.data || levelJson; // Fallback for backward compat

          // Create local room using global Room class with LocalIO for particle/sound events
          this.localRoom = new Room(
            "Solo Room",
            999,
            [levelId],
            playerName,
            new LocalIO(this.particles, this.sounds)
          );
          this.localRoom.maxplayernb = 100;

          // Load level using global loadlevel function
          if (typeof loadlevel === "function") {
            await loadlevel(levelData, this.localRoom);
          }

          // Spawn player
          this.localRoom.spawn_new_player(
            playerName,
            tankColors.turret,
            tankColors.body,
            this.mysocketid
          );

          // Spawn bots
          this.localRoom.spawn_all_bots();

          // Count initial bots/enemies to determine win condition
          // Players object uses socketid as key
          this.initialBotCount = Object.entries(this.localRoom.players).filter(
            ([socketid, _player]) => socketid !== this.mysocketid
          ).length;

          // Start loops
          this._startLoops();
          resolve();
        } catch (err) {
          console.error("Failed to load level:", err);
          reject(err);
        }
      });
    });
  }

  startOnline(roomId, playerName, tankColors) {
    this.mode = "online";
    this.running = true;
    this.paused = false;
    this.roomId = roomId;

    // Set up online mode listeners
    this.socket.on("tick", this._onTick);
    this.socket.on("level_change", this._onLevelChange);

    // Join the room
    this.socket.emit(
      "play",
      playerName,
      tankColors.turret,
      tankColors.body,
      roomId
    );

    // Wait for 'id' event confirming we joined
    return new Promise((resolve, reject) => {
      this.socket.once("id", (room_id, pid, socketid) => {
        this.roomId = room_id;
        this.playerId = pid;
        this.mysocketid = socketid;
        this._startLoops();
        resolve();
      });

      this.socket.once("id-fail", () => {
        reject(new Error("Failed to join room"));
      });
    });
  }

  _startLoops() {
    // Guard: Don't start loops if engine was quit during async initialization
    if (!this.running) {
      return;
    }

    // Start in countdown mode (solo only - multiplayer countdown is triggered by server)
    if (this.mode === "solo") {
      this.inCountdown = true;

      // Trigger countdown callback so UI can show countdown
      if (this.onCountdownStart) {
        this.onCountdownStart();
      }
    }

    // Start render loop (requestAnimationFrame)
    this.animationId = requestAnimationFrame(this._renderLoop);

    // Start game loop (60fps via setInterval for consistent timing)
    if (this.mode === "solo") {
      this.loopId = setInterval(() => {
        if (!this.paused) {
          this._soloUpdate();
        }
      }, 1000 / 60);
    } else {
      // Online mode: send input every tick
      this.loopId = setInterval(() => {
        if (!this.paused) {
          this._sendInput();
        }
        this.tick++;
      }, 1000 / 60);
    }
  }

  // Called when countdown finishes to enable gameplay
  endCountdown() {
    this.inCountdown = false;
    // Clear any input that was buffered during countdown to prevent teleporting
    this.input.clearInput();
    // Reset start time for accurate timing
    this.startTime = performance.now();
  }

  _soloUpdate() {
    if (!this.localRoom) return;

    // During countdown, just render current state - NO game updates (freeze everything)
    if (this.inCountdown) {
      // Just sync state for rendering (no room.update() - freeze players and bots)
      this.players = this.localRoom.players;
      this.blocks = this.localRoom.blocks;
      this.Bcollision = this.localRoom.Bcollision;
      this.bullets = this.localRoom.bullets;
      this.mines = this.localRoom.mines;
      this.holes = this.localRoom.holes;
      return;
    }

    // Get input
    const input = this.input.getInputState();

    // Resume AudioContext on first interaction if needed
    if (input.click || input.direction.x !== 0 || input.direction.y !== 0) {
      this.sounds.resume();
    }

    // Handle pause
    if (input.escapePressed && this.onPause) {
      this.onPause();
      return;
    }

    // Check for game over conditions
    const myPlayer = this.localRoom.players[this.mysocketid];
    if (myPlayer) {
      // 1. Check for Loss (Player died)
      if (!myPlayer.alive && this.running && !this.gameOverTriggered) {
        this.gameOverTriggered = true;
        this._triggerSoloGameOver(false);
        return;
      }

      // 2. Check for Win (All bots/enemies died)
      // Players are stored with socketid as key. Filter out our player by key.
      const enemyEntries = Object.entries(this.localRoom.players).filter(
        ([socketid, _player]) => socketid !== this.mysocketid
      );

      // Check if any enemy is alive
      const anyEnemyAlive = enemyEntries.some(([_id, p]) => p.alive);

      if (
        this.initialBotCount > 0 &&
        !anyEnemyAlive &&
        this.running &&
        !this.gameOverTriggered
      ) {
        this.gameOverTriggered = true;
        this._triggerSoloGameOver(true);
        return;
      }
    }

    // Update player
    const player = this.localRoom.players[this.mysocketid]; // mysocketid is 999 for solo
    if (player) {
      player.direction = input.direction;
      player.aim = input.aim;
      if (input.plant) {
        player.plant(this.localRoom);
      }
      if (input.click) {
        if (player.alive && player.bulletcount < player.max_bulletcount) {
          player.shoot(this.localRoom);
          // Manually play sound because Room.update() resets sounds before emitting
          this.sounds.playSounds({ shoot: true });
        } else {
          player.shoot(this.localRoom);
        }
      }
    }

    // Sync globals for bots (they rely on window.*)
    window.room = this.localRoom;
    window.localroom = this.localRoom;
    window.players = this.localRoom.players;
    window.bullets = this.localRoom.bullets;
    window.mines = this.localRoom.mines;
    window.blocks = this.localRoom.blocks;
    window.Bcollision = this.localRoom.Bcollision;
    window.holes = this.localRoom.holes;
    window.c = this.renderer.c;
    window.debug_visual = true; // Enable debug visuals for bots if needed

    // Update room (handles bot updates via Room.update_players)
    // Fuse sound logic for mines
    this.localRoom.mines.forEach((mine) => {
      // 220 is when visual flashing starts (300 is explosion)
      if (mine.timealive > 220 && mine.timealive % 40 === 0) {
        this.sounds.playFuse();
      }
    });

    // Calculate fps correction
    const now = performance.now();
    this.fpsCorrector = (now - this.oldTime) / 16.67;
    this.oldTime = now;

    // Expose game state as globals BEFORE update (required for Bot AI scripts)
    window.players = this.localRoom.players;
    window.blocks = this.localRoom.blocks;
    window.Bcollision = this.localRoom.Bcollision;
    window.bullets = this.localRoom.bullets;
    window.mines = this.localRoom.mines;
    window.holes = this.localRoom.holes;
    window.localroom = this.localRoom;
    window.room = this.localRoom; // Alias for bots that use 'room'
    window.c = this.renderer.c;
    window.debug_visual = this.renderer.debugVisual;

    // Update room
    this.localRoom.update(this.fpsCorrector);

    // Play sounds - LocalIO handles this via tick_sounds event from Room?
    // If we play it here AND in LocalIO, it might be double.
    // However, if Room.js clears sounds after emission, checking here is safe effectively if empty.
    // But if sound works "sometimes", maybe we are overflooding the pool?
    // Let's try to keep both but ensure we don't error.
    this.sounds.playSounds(this.localRoom.sounds);

    // Sync local state for rendering
    this.players = this.localRoom.players;
    this.blocks = this.localRoom.blocks;
    this.Bcollision = this.localRoom.Bcollision;
    this.bullets = this.localRoom.bullets;
    this.mines = this.localRoom.mines;
    this.holes = this.localRoom.holes;

    this.tick++;
  }

  _sendInput() {
    if (!this.socket || this.mode !== "online") return;

    const input = this.input.getInputState();

    // Handle pause
    if (input.escapePressed && this.onPause) {
      this.onPause();
      return;
    }

    this.socket.emit("tock", {
      serverid: this.serverId,
      mysocketid: this.mysocketid,
      playerid: this.playerId,
      direction: input.direction,
      plant: input.plant,
      click: input.click,
      aim: input.aim,
      room_id: this.roomId,
      mytick: this.tick,
    });
  }

  _onTick(data) {
    this.bullets = data.bullets;
    this.mines = data.mines;
    this.tick = data.tick;
    this.players = data.players;
    this.holes = data.holes;
  }

  _onLevelChange(data) {
    this.blocks = data.blocks;
    this.Bcollision = data.Bcollision;
  }

  _renderLoop() {
    if (!this.running) return;

    // Update particles
    this.particles.update();

    // Trigger fast bullet particles (Rocket trails)
    if (this.bullets) {
      this.bullets.forEach((bullet) => {
        if (bullet.type === 2) {
          this.particles.fastBullets(
            {
              x:
                bullet.position.x +
                bullet.size.w / 2 +
                (Math.cos(bullet.angle) * bullet.size.w) / 2,
              y:
                bullet.position.y +
                bullet.size.h / 2 +
                (Math.sin(bullet.angle) * bullet.size.h) / 2,
            },
            bullet.angle,
            10
          );
        }
      });
    }

    // Render game state
    this.renderer.draw({
      mines: this.mines,
      holes: this.holes,
      blocks: this.blocks,
      Bcollision: this.Bcollision,
      bullets: this.bullets,
      players: this.players,
    });

    // Render particles
    this.particles.draw(this.renderer.c);

    // Continue loop
    this.animationId = requestAnimationFrame(this._renderLoop);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.oldTime = performance.now();
  }

  quit() {
    this.running = false;
    this.paused = false;

    // Stop loops
    if (this.loopId) {
      clearInterval(this.loopId);
      this.loopId = null;
    }
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Clean up listeners
    if (this.socket) {
      this.socket.off("tick", this._onTick);
      this.socket.off("level_change", this._onLevelChange);
    }

    // Clean up input
    this.input.destroy();

    // Clear particles and sounds
    this.particles.clear();
    this.sounds.clear();

    // Leave room if online
    if (this.socket && this.mode === "online") {
      this.socket.emit("quit");
    }
  }

  _triggerSoloGameOver(isWin) {
    if (this.onGameOver) {
      const endTime = performance.now();
      const timeElapsed = Math.floor((endTime - this.startTime) / 1000);

      // Get player stats
      const myPlayer = this.localRoom?.players[this.mysocketid];
      const playerStats = myPlayer?.round_stats?.stats || {};

      this.onGameOver({
        result: isWin ? "win" : "lose",
        timeElapsed: timeElapsed,
        gridId: this.localRoom ? this.localRoom.grid_id : null,
        levelInfo: this.levelMetadata
          ? {
              name: this.levelMetadata.level_name,
              creator: this.levelMetadata.level_creator_name,
              thumbnail: this.levelMetadata.level_img,
            }
          : null,
        stats: {
          shots: playerStats.shots || 0,
          hits: playerStats.hits || 0,
          kills: playerStats.kills || 0,
          plants: playerStats.plants || 0,
          blocksDestroyed: playerStats.blocks_destroyed || 0,
        },
      });
    }
  }

  setTheme(theme) {
    this.renderer.setTheme(theme || 1);
  }

  toggleDebug() {
    this.renderer.debugVisual = !this.renderer.debugVisual;
  }

  setScale(scale) {
    this.input.setScale(scale);
  }
}
