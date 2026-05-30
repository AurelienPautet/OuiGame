/**
 * GameEngine - Main game loop manager supporting both solo and online modes
 *
 * Solo: Local Room simulation with 60fps loop
 * Online: Listens to server 'tick' events, sends input via 'tock'
 *
 * The game runtime (Room, loadlevel, Player, Bot, ...) is imported from the
 * @ouigame/shared/game package — the same isomorphic simulation the server
 * runs. This replaces the old browser <script> tags that exposed those classes
 * as window globals.
 */
import { Room, loadlevel } from "@ouigame/shared/game";
import type { RoomPlayer } from "@ouigame/shared/game";
import type { Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@ouigame/shared/socket";
import type {
  PositionEvent,
  PositionAngleEvent,
  RoomSnapshot,
  LevelChange,
} from "@ouigame/shared/types";
import type { ReceiveJsonFromId } from "@ouigame/shared/api";
import { Renderer } from "./Renderer.js";
import { InputHandler } from "./InputHandler.js";
import { ParticleSystem } from "./ParticleSystem.js";
import { SoundManager, type SoundEvents } from "./SoundManager.js";

// The engine consumes the SAME strictly-typed socket the app creates, so every
// on/once/off/emit is checked against the shared event maps.
// socket.io-client's generic order is <ListenEvents, EmitEvents> = (S2C, C2S).
type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface TankColors {
  turret: string;
  body: string;
}

interface SoloGameOverResult {
  result: "win" | "lose";
  timeElapsed: number;
  gridId: unknown;
  levelInfo: {
    name?: string;
    creator?: string;
    thumbnail?: string | null;
  } | null;
  stats: {
    shots: number;
    hits: number;
    kills: number;
    plants: number;
    blocksDestroyed: number;
  };
}

type GameMode = "solo" | "online";

// LocalIO class for solo mode - forwards events to particle/sound systems
class LocalIO {
  particles: ParticleSystem;
  sounds: SoundManager;

  constructor(particles: ParticleSystem, sounds: SoundManager) {
    this.particles = particles;
    this.sounds = sounds;
  }

  emit(event: string, data: any) {
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
  canvas: HTMLCanvasElement;
  socket: GameSocket | null;
  mode: GameMode | null;

  // Systems
  renderer: Renderer;
  input: InputHandler;
  particles: ParticleSystem;
  sounds: SoundManager;

  // Game state
  running: boolean;
  paused: boolean;
  inCountdown: boolean;
  loopId: ReturnType<typeof setInterval> | null;
  animationId: number | null;

  // Timing
  oldTime: number;
  fpsCorrector: number;
  tick: number;

  // Solo mode state
  localRoom: Room | null;
  mysocketid: string | null;
  gameOverTriggered: boolean;
  startTime: number;
  initialBotCount: number;
  onGameOver: ((result: SoloGameOverResult) => void) | null;
  levelMetadata?: ReceiveJsonFromId;

  // Online mode state
  roomId: number | string | null;
  serverId: string | null;
  playerId: number | null;

  // Game entities (received from server in online mode)
  players: Record<string, RoomPlayer>;
  blocks: unknown[];
  Bcollision: unknown[];
  bullets: any[];
  mines: any[];
  holes: unknown[];

  // Callbacks
  onPause: (() => void) | null;
  onQuit: (() => void) | null;
  onCountdownStart: (() => void) | null;

  // Bound particle/sound socket listeners — stored as fields so quit() can
  // remove the exact same references (inline arrows could not be removed, so
  // listeners stacked on every remount).
  private _onRicochet: (data: PositionAngleEvent) => void;
  private _onBulletExplosion: (data: PositionEvent) => void;
  private _onShootExplosion: (data: PositionAngleEvent) => void;
  private _onPlayerExplosion: (data: PositionEvent) => void;
  private _onMineExplosion: (data: PositionEvent) => void;
  private _onTickSounds: (sounds: SoundEvents) => void;

  constructor(
    canvas: HTMLCanvasElement,
    fadingCanvas: HTMLCanvasElement | null,
    socket: GameSocket | null
  ) {
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

    // Bind particle/sound listeners as stable fields (leak fix — see quit()).
    this._onRicochet = (data) => {
      this.particles.ricochetSparks(data.position, data.angle, 20);
    };
    this._onBulletExplosion = (data) => {
      this.particles.bulletExplosion(data.position, 100);
    };
    this._onShootExplosion = (data) => {
      this.particles.shootExplosion(data.position, data.angle, 30);
    };
    this._onPlayerExplosion = (data) => {
      this.particles.explosion(data.position, 100);
    };
    this._onMineExplosion = (data) => {
      this.particles.explosion(data.position, 100);
    };
    this._onTickSounds = (sounds) => {
      this.sounds.playSounds(sounds);
    };

    // Set up particle socket listeners
    this._setupParticleListeners();
  }

  _setupParticleListeners() {
    if (!this.socket) return;

    this.socket.on("ricochet_explosion", this._onRicochet);
    this.socket.on("bullet_explosion", this._onBulletExplosion);
    this.socket.on("shoot_explosion", this._onShootExplosion);
    this.socket.on("player_explosion", this._onPlayerExplosion);
    this.socket.on("mine_explosion", this._onMineExplosion);
    this.socket.on("tick_sounds", this._onTickSounds);
  }

  async startSolo(
    levelId: number,
    playerName: string,
    tankColors: TankColors
  ): Promise<void> {
    this.mode = "solo";
    this.running = true;
    this.paused = false;

    // Generate a fake socket ID for solo mode
    this.mysocketid = "solo_player_" + Math.random().toString(36).substr(2, 9);
    this.startTime = performance.now();
    this.gameOverTriggered = false;

    // Request level data from server
    return new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error("No socket connection"));
        return;
      }

      this.socket.emit("get_json_from_id", levelId);

      this.socket.once("recieve_json_from_id", async (levelJson) => {
        try {
          if (!levelJson) {
            reject(new Error("Level not found"));
            return;
          }
          // levelJson now contains { data: [...], level_name, level_creator_name, level_img }
          // Store full object as metadata for end screen
          this.levelMetadata = levelJson;

          // Extract the actual level data array for loading
          const levelData = levelJson.data ?? levelJson; // Fallback for backward compat

          // Create local room with LocalIO for particle/sound events
          this.localRoom = new Room(
            "Solo Room",
            999,
            [levelId],
            playerName,
            new LocalIO(this.particles, this.sounds)
          );
          this.localRoom.maxplayernb = 100;

          // Load level into the room
          await loadlevel(levelData, this.localRoom);

          // Spawn player
          this.localRoom.spawn_new_player(
            playerName,
            tankColors.turret,
            tankColors.body,
            this.mysocketid!
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

  startOnline(
    roomId: number | string,
    playerName: string,
    tankColors: TankColors
  ): Promise<void> {
    this.mode = "online";
    this.running = true;
    this.paused = false;
    this.roomId = roomId;

    const socket = this.socket;
    if (!socket) {
      return Promise.reject(new Error("No socket connection"));
    }

    // Set up online mode listeners
    socket.on("tick", this._onTick);
    socket.on("level_change", this._onLevelChange);

    // Join the room
    socket.emit("play", playerName, tankColors.turret, tankColors.body, roomId);

    // Wait for 'id' event confirming we joined
    return new Promise<void>((resolve, reject) => {
      socket.once("id", (room_id, pid, socketid) => {
        this.roomId = room_id;
        this.playerId = pid;
        this.mysocketid = socketid;
        this._startLoops();
        resolve();
      });

      socket.once("id-fail", () => {
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
    const myPlayer = this.localRoom.players[this.mysocketid!];
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
    const player = this.localRoom.players[this.mysocketid!]; // mysocketid is 999 for solo
    if (player) {
      player.direction = input.direction;
      player.aim = input.aim;
      if (input.plant) {
        player.plant(this.localRoom);
      }
      if (input.click) {
        if (
          player.alive &&
          (player.bulletcount as number) < (player.max_bulletcount as number)
        ) {
          player.shoot(this.localRoom);
          // Manually play sound because Room.update() resets sounds before emitting
          this.sounds.playSounds({ shoot: true });
        } else {
          player.shoot(this.localRoom);
        }
      }
    }

    // Update room (handles bot updates via Room.update_players)
    // Fuse sound logic for mines
    this.localRoom.mines.forEach((mine: any) => {
      // 220 is when visual flashing starts (300 is explosion)
      if (mine.timealive > 220 && mine.timealive % 40 === 0) {
        this.sounds.playFuse();
      }
    });

    // Calculate fps correction
    const now = performance.now();
    this.fpsCorrector = (now - this.oldTime) / 16.67;
    this.oldTime = now;

    // Update room. The bots' AI reads game state from the room it is passed
    // (no more window.* sync); the canvas context + debug flag are threaded in
    // for the bots' optional debug raycast overlays.
    this.localRoom.update(
      this.fpsCorrector,
      this.renderer.c,
      this.renderer.debugVisual
    );

    // Play sounds - LocalIO handles this via tick_sounds event from Room?
    // If we play it here AND in LocalIO, it might be double.
    // However, if Room.js clears sounds after emission, checking here is safe effectively if empty.
    // But if sound works "sometimes", maybe we are overflooding the pool?
    // Let's try to keep both but ensure we don't error.
    // Room.sounds is a runtime sound-events object (the web's loose ambient
    // type only knows it as unknown[]).
    this.sounds.playSounds(this.localRoom.sounds as unknown as SoundEvents);

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

  _onTick(data: any) {
    this.bullets = data.bullets;
    this.mines = data.mines;
    this.tick = data.tick;
    this.players = data.players;
    this.holes = data.holes;
  }

  _onLevelChange(data: any) {
    this.blocks = data.blocks;
    this.Bcollision = data.Bcollision;
  }

  _renderLoop() {
    if (!this.running) return;

    // Update particles
    this.particles.update();

    // Trigger fast bullet particles (Rocket trails)
    if (this.bullets) {
      this.bullets.forEach((bullet: any) => {
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

    // Render game state. The engine holds these entities loosely (server- or
    // Room-shaped); the Renderer's GameState describes the same shapes, so cast.
    this.renderer.draw({
      mines: this.mines,
      holes: this.holes,
      blocks: this.blocks,
      Bcollision: this.Bcollision,
      bullets: this.bullets,
      players: this.players,
    } as unknown as Parameters<typeof this.renderer.draw>[0]);

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

      // Remove the particle/sound listeners registered in the constructor.
      // These were previously inline arrows and could never be detached, so
      // they accumulated on the shared socket across every engine remount.
      this.socket.off("ricochet_explosion", this._onRicochet);
      this.socket.off("bullet_explosion", this._onBulletExplosion);
      this.socket.off("shoot_explosion", this._onShootExplosion);
      this.socket.off("player_explosion", this._onPlayerExplosion);
      this.socket.off("mine_explosion", this._onMineExplosion);
      this.socket.off("tick_sounds", this._onTickSounds);
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

  _triggerSoloGameOver(isWin: boolean) {
    if (this.onGameOver) {
      const endTime = performance.now();
      const timeElapsed = Math.floor((endTime - this.startTime) / 1000);

      // Get player stats
      const myPlayer = this.localRoom?.players[this.mysocketid!];
      const playerStats: Record<string, number> =
        myPlayer?.round_stats?.stats || {};

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

  setTheme(theme: number) {
    this.renderer.setTheme(theme || 1);
  }

  toggleDebug() {
    this.renderer.debugVisual = !this.renderer.debugVisual;
  }

  setScale(scale: number) {
    this.input.setScale(scale);
  }
}
