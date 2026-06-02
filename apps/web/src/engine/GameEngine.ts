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
import {
  Room,
  loadlevel,
  SIM_STEP_S,
  SIM_STEP_MS,
  MAX_SUBSTEPS,
  MAX_FRAME_MS,
  INTERP_DELAY_MS,
} from "@ouigame/shared/game";
import type { RoomIo } from "@ouigame/shared/game";
import {
  clamp,
  lerpPose,
  poseOf,
  withPose,
  sampleBuffer,
  pruneBuffer,
  type Pose,
  type Posable,
  type TimedFrame,
} from "./interpolation.js";
import type { RoomPlayer, RenderBullet, RenderMine } from "./runtimeTypes.js";
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
import { InputHandler, type InputSnapshot } from "./InputHandler.js";
import { ParticleSystem } from "./ParticleSystem.js";
import { DebrisSystem } from "./Debris.js";
import { SoundManager, type SoundEvents } from "./SoundManager.js";
import { PostProcessor, tryCreatePostProcessor } from "./PostProcessor.js";
import type { EnvBlock, EnvHole } from "./PostProcessor.js";
import type { EffectSettings } from "../lib/settings";

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

// Captured render poses for one simulation step, keyed by entity id, used to
// interpolate the solo display between fixed sim steps.
interface PoseFrame {
  players: Record<string, Pose>;
  bullets: Record<number, Pose>;
  mines: Record<number, Pose>;
}

// The positioned slice of a server snapshot we interpolate for the online
// display (other fields are read from the latest snapshot directly).
interface ServerFrame {
  players: Record<string, RoomPlayer>;
  bullets: RenderBullet[];
  mines: RenderMine[];
}

// Duration of the round-start parachute drop. Kept comfortably under the ~3s
// countdown (solo 3-2-1-GO; server countdownDuration) so tanks have touched down
// and the chutes have cleared before play begins.
const SPAWN_ANIM_MS = 2600;

// LocalIO is the solo-mode sink the local Room broadcasts through. It satisfies
// the shared RoomIo contract, so its `emit` is type-checked against the same
// ServerToClientEvents map the online socket uses: the event names below are
// verified against the wire contract and each payload is the type the contract
// declares for it. Solo only reacts to the explosion + sound broadcasts; the
// rest (tick, winner, level_change, ...) are read straight off the local Room
// each frame, so they fall through.
class LocalIO implements RoomIo {
  particles: ParticleSystem;
  sounds: SoundManager;
  post: PostProcessor | null;

  constructor(
    particles: ParticleSystem,
    sounds: SoundManager,
    post: PostProcessor | null
  ) {
    this.particles = particles;
    this.sounds = sounds;
    this.post = post;
  }

  emit<E extends keyof ServerToClientEvents>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) {
    switch (event) {
      case "ricochet_explosion": {
        const { position, angle } = args[0] as PositionAngleEvent;
        this.particles.ricochetSparks(position, angle, 20);
        break;
      }
      case "bullet_explosion": {
        const { position } = args[0] as PositionEvent;
        this.particles.bulletExplosion(position, 100);
        this.post?.shockwave(position, 0.016, 420);
        break;
      }
      case "shoot_explosion": {
        const { position, angle } = args[0] as PositionAngleEvent;
        this.particles.shootExplosion(position, angle, 30);
        // Small, short muzzle pop at the barrel tip — subtle since firing is
        // frequent, so it punches without churning the screen.
        this.post?.shockwave(position, 0.012, 280);
        break;
      }
      case "player_explosion": {
        const { position } = args[0] as PositionEvent;
        this.particles.explosion(position, 100);
        this.post?.shockwave(position, 0.04, 650);
        this.post?.shake(0.6);
        break;
      }
      case "mine_explosion": {
        const { position } = args[0] as PositionEvent;
        this.particles.explosion(position, 100);
        this.post?.shockwave(position, 0.04, 650);
        this.post?.shake(0.6);
        break;
      }
      case "tick_sounds":
        this.sounds.playSounds(args[0] as SoundEvents);
        break;
    }
  }

  to(): this {
    return this; // Allow chaining: io.to(roomId).emit(...)
  }

  on() {}
  off() {}
}

// Distance (in canvas units) at which a relative touch aim-vector is projected
// from the player's centre to synthesise the absolute `aim` point. Only the
// resulting angle is consumed by the sim (Player.CalculateAngle), so the exact
// value is arbitrary — it just needs to be non-zero.
const AIM_RADIUS = 300;

// Resolve the absolute aim point from a possibly-relative input snapshot. With a
// touch aim-vector we project from the local player's centre; otherwise we keep
// the pointer-driven `aim`. The resolved point is also written back to
// `window.gameInput.aim` so the on-screen reticle (GameCursor) keeps tracking.
function resolveAim(
  input: InputSnapshot,
  center: { x: number; y: number } | null
): { x: number; y: number } {
  if (input.aimVector && center) {
    const aim = {
      x: center.x + input.aimVector.x * AIM_RADIUS,
      y: center.y + input.aimVector.y * AIM_RADIUS,
    };
    if (typeof window !== "undefined" && window.gameInput) {
      window.gameInput.aim = aim;
    }
    return aim;
  }
  return input.aim;
}

export class GameEngine {
  canvas: HTMLCanvasElement;
  socket: GameSocket | null;
  mode: GameMode | null;

  // Systems
  renderer: Renderer;
  input: InputHandler;
  particles: ParticleSystem;
  // Physics-driven wreck pieces (the cannon that flies off a destroyed tank).
  debris: DebrisSystem;
  sounds: SoundManager;
  // WebGL post-processing (bloom / shockwave). null when WebGL is unavailable,
  // in which case the plain 2D canvases are shown instead.
  post: PostProcessor | null;

  // Game state
  running: boolean;
  paused: boolean;
  inCountdown: boolean;
  // Elapsed time (ms) into the round-start parachute drop, or null when no drop
  // is in flight. Advances in _frame (frozen while paused) so the animation
  // stays in step with the on-screen countdown.
  spawnAnimElapsed: number | null;
  loopId: ReturnType<typeof setInterval> | null;
  animationId: number | null;

  // Timing — fixed-timestep accumulator (the sim advances in whole SIM_STEP_S
  // slices; the render loop interpolates between sim states with `renderAlpha`).
  oldTime: number;
  simAccumulator: number;
  tick: number;

  // Render interpolation buffers. Solo keeps the previous + current captured sim
  // poses; online buffers timestamped server snapshots and renders slightly in
  // the past (INTERP_DELAY_MS) so it always has two states to blend.
  soloPrev: PoseFrame | null;
  soloCurr: PoseFrame | null;
  snapshotBuffer: TimedFrame<ServerFrame>[];
  // Input sampled once for the current frame (solo), applied to the fixed steps.
  private _frameInput: InputSnapshot | null;

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
  // Tracks whether our player was alive last tick, to fire the death flash on
  // the alive→dead transition (online). Undefined `alive` is treated as alive.
  prevMyAlive: boolean;
  // Our kill count last frame, to fire the kill-confirmed pop when it rises.
  prevMyKills: number;
  // Per-player alive flag last frame, so we can fire the flying-cannon debris on
  // any tank's alive→dead transition (solo + online). Keyed by socket id.
  prevAlive: Record<string, boolean>;

  // Game entities (received from server in online mode)
  players: Record<string, RoomPlayer>;
  blocks: unknown[];
  Bcollision: unknown[];
  bullets: RenderBullet[];
  mines: RenderMine[];
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
    glCanvas: HTMLCanvasElement | null,
    socket: GameSocket | null
  ) {
    this.canvas = canvas;
    this.socket = socket;
    this.mode = null; // 'solo' | 'online'

    // Systems
    this.renderer = new Renderer(canvas, fadingCanvas);
    this.input = new InputHandler(canvas);
    this.particles = new ParticleSystem();
    this.debris = new DebrisSystem();
    this.sounds = new SoundManager();

    // Optional WebGL post-processing — same factory the level editor uses. On
    // any failure (no WebGL, shader/link error) `post` stays null and the React
    // layer shows the 2D canvases directly.
    this.post = glCanvas
      ? tryCreatePostProcessor(
          glCanvas,
          this.renderer.width,
          this.renderer.height
        )
      : null;
    // When post is active it draws the field/holes/walls in GL, so the 2D
    // renderer must skip them to avoid double-drawing.
    this.renderer.skipEnvironment = this.post !== null;

    // Game state
    this.running = false;
    this.paused = false;
    this.inCountdown = false; // When true, render but ignore input
    this.spawnAnimElapsed = null;
    this.loopId = null;
    this.animationId = null;

    // Timing
    this.oldTime = performance.now();
    this.simAccumulator = 0;
    this.tick = 0;
    this.soloPrev = null;
    this.soloCurr = null;
    this.snapshotBuffer = [];
    this._frameInput = null;

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
    this.prevMyAlive = true;
    this.prevMyKills = 0;
    this.prevAlive = {};

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
    this._frame = this._frame.bind(this);
    this._onTick = this._onTick.bind(this);
    this._onLevelChange = this._onLevelChange.bind(this);

    // Bind particle/sound listeners as stable fields (leak fix — see quit()).
    this._onRicochet = (data) => {
      this.particles.ricochetSparks(data.position, data.angle, 20);
    };
    this._onBulletExplosion = (data) => {
      this.particles.bulletExplosion(data.position, 100);
      this.post?.shockwave(data.position, 0.016, 420);
    };
    this._onShootExplosion = (data) => {
      this.particles.shootExplosion(data.position, data.angle, 30);
      this.post?.shockwave(data.position, 0.012, 280);
    };
    this._onPlayerExplosion = (data) => {
      this.particles.explosion(data.position, 100);
      this.post?.shockwave(data.position, 0.04, 650);
      this.post?.shake(0.6);
    };
    this._onMineExplosion = (data) => {
      this.particles.explosion(data.position, 100);
      this.post?.shockwave(data.position, 0.04, 650);
      this.post?.shake(0.6);
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
            new LocalIO(this.particles, this.sounds, this.post)
          );
          this.localRoom.maxplayernb = 100;

          // Load level into the room. levelData is the flat number[] grid
          // (pulled from the fetched level JSON, loosely typed here).
          await loadlevel(levelData as number[], this.localRoom);

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
      // Kick off the round-start parachute drop alongside the countdown.
      this.startSpawnAnimation();

      // Trigger countdown callback so UI can show countdown
      if (this.onCountdownStart) {
        this.onCountdownStart();
      }

      // Seed both interpolation snapshots so the very first rendered frame has a
      // previous + current state to blend (identical → no motion).
      this._captureSolo();
      this._captureSolo();
    }

    // Single requestAnimationFrame loop drives both the fixed-timestep
    // simulation and the interpolated display (see _frame).
    this.simAccumulator = 0;
    this.oldTime = performance.now();
    this.animationId = requestAnimationFrame(this._frame);
  }

  // Begin the round-start parachute drop. Solo calls this from _startLoops;
  // online calls it when the server's `countdown_start` arrives, so both modes
  // animate the drop in step with their countdown.
  startSpawnAnimation() {
    this.spawnAnimElapsed = 0;
  }

  // Called when countdown finishes to enable gameplay
  endCountdown() {
    this.inCountdown = false;
    // The drop is finished; render tanks normally from here on.
    this.spawnAnimElapsed = null;
    // Clear any input that was buffered during countdown to prevent teleporting
    this.input.clearInput();
    // Reset start time for accurate timing
    this.startTime = performance.now();
    // Drop any time banked during the countdown so play doesn't start with a
    // burst of catch-up steps.
    this.simAccumulator = 0;
    this.oldTime = performance.now();
  }

  // The unified frame: advance the simulation in fixed steps to catch up with
  // real time, then render the display interpolated between sim states. This
  // fully decouples game speed (fixed 60 Hz) from the display refresh rate.
  _frame(now: number) {
    if (!this.running) return;

    // Advance the round-start drop on the wall clock, frozen while paused so it
    // stays aligned with the (also pausable) countdown overlay.
    if (this.spawnAnimElapsed !== null && !this.paused) {
      this.spawnAnimElapsed += Math.min(now - this.oldTime, MAX_FRAME_MS);
    }

    const simulating =
      !this.paused && !(this.mode === "solo" && this.inCountdown);

    if (simulating) {
      let elapsed = now - this.oldTime;
      if (elapsed > MAX_FRAME_MS) elapsed = MAX_FRAME_MS;
      this.simAccumulator += elapsed;

      // Sample input once per frame; the fixed steps below consume it. One-shot
      // actions (shoot/plant) are handled here so a click maps to exactly one
      // shot regardless of how many sim steps or render frames occur.
      if (this.mode === "solo") this._beginSoloFrameInput();

      let steps = 0;
      while (this.simAccumulator >= SIM_STEP_MS && steps < MAX_SUBSTEPS) {
        this._simStep();
        this.simAccumulator -= SIM_STEP_MS;
        steps++;
      }
      // Spiral-of-death guard: if we hit the cap, drop the unprocessed backlog.
      if (steps === MAX_SUBSTEPS) this.simAccumulator = 0;

      if (this.mode === "solo" && this.localRoom) {
        this._syncStateFromRoom(this.localRoom);
        this._checkSoloGameOver();
      }
    } else {
      // Not simulating (paused or countdown): keep current state on screen and
      // don't let real time pile up into the accumulator.
      this.simAccumulator = 0;
      if (this.mode === "solo" && this.localRoom) {
        this._syncStateFromRoom(this.localRoom);
      }
    }
    this.oldTime = now;

    const alpha = clamp(this.simAccumulator / SIM_STEP_MS, 0, 1);
    this._render(alpha);

    this.animationId = requestAnimationFrame(this._frame);
  }

  // One fixed simulation step. Solo advances the local authoritative room;
  // online ships the player's input at the fixed cadence (server is the sim).
  _simStep() {
    if (this.mode === "solo") {
      this._simStepSolo();
    } else {
      this._sendInput();
      this.tick++;
    }
  }

  // Sample input once for this frame and apply the UI-level / one-shot parts
  // (audio resume, pause, shoot, plant). Continuous input (direction/aim) is set
  // on the player here too; the fixed sim steps then read it off the player.
  // One-shots fire once per frame so a single click is always exactly one shot,
  // independent of the display refresh rate.
  _beginSoloFrameInput() {
    const room = this.localRoom;
    if (!room) {
      this._frameInput = null;
      return;
    }

    const input = this.input.getInputState();
    this._frameInput = input;

    // Resume AudioContext on first interaction if needed
    if (input.click || input.direction.x !== 0 || input.direction.y !== 0) {
      this.sounds.resume();
    }

    // Handle pause
    if (input.escapePressed && this.onPause) {
      this.onPause();
      return;
    }

    const player = room.players[this.mysocketid!]; // mysocketid is 999 for solo
    if (player) {
      player.direction = input.direction;
      player.aim = resolveAim(input, this._localPlayerCenter());
      if (input.plant) {
        player.plant(room);
      }
      // `click` is a one-shot tap; `firing` is the held touch auto-fire. Both
      // flow through Player.shoot(), which gates on alive + bullet count.
      if (input.click || input.firing) {
        if (
          player.alive &&
          (player.bulletcount as number) < (player.max_bulletcount as number)
        ) {
          player.shoot(room);
          // Manually play sound because Room.update() resets sounds before emitting
          this.sounds.playSounds({ shoot: true });
        } else {
          player.shoot(room);
        }
      }
    }
  }

  // Centre (canvas coords) of the local player, used to project a relative touch
  // aim-vector into an absolute aim point. Reads solo room state or the latest
  // online snapshot — whichever this mode populates. null if not yet known.
  _localPlayerCenter(): { x: number; y: number } | null {
    const p =
      this.mode === "solo"
        ? this.localRoom?.players[this.mysocketid!]
        : this.mysocketid
          ? this.players[this.mysocketid]
          : undefined;
    const pos = p?.position as { x: number; y: number } | undefined;
    const size = p?.size as { w: number; h: number } | undefined;
    if (!pos || !size) return null;
    return { x: pos.x + size.w / 2, y: pos.y + size.h / 2 };
  }

  // Advance the local authoritative room by exactly one fixed step.
  _simStepSolo() {
    const room = this.localRoom;
    if (!room) return;

    // Fuse sound logic for mines. Room.mines is loosely typed (unknown[]) by the
    // ambient runtime contract; narrow to the render shape we read here.
    (room.mines as RenderMine[]).forEach((mine) => {
      // 220 is when visual flashing starts (300 is explosion)
      if (mine.timealive > 220 && mine.timealive % 40 === 0) {
        this.sounds.playFuse();
      }
    });

    // Advance one fixed step. The bots' AI reads game state from the room it is
    // passed; the canvas context + debug flag are threaded in for the bots'
    // optional debug raycast overlays.
    room.update(SIM_STEP_S, this.renderer.c, this.renderer.debugVisual);

    // Kill-confirmed pop when our own kill count ticks up this step.
    const myKills =
      room.players[this.mysocketid!]?.round_stats?.stats?.kills ?? 0;
    if (myKills > this.prevMyKills) this.post?.killFlash(1);
    this.prevMyKills = myKills;

    // Room.sounds is a runtime sound-events object (the web's loose ambient type
    // only knows it as unknown[]).
    this.sounds.playSounds(room.sounds as unknown as SoundEvents);

    // Record this step's poses for display interpolation.
    this._captureSolo();

    this.tick++;
  }

  // Win/lose detection for solo, run once per frame off the latest room state.
  _checkSoloGameOver() {
    const room = this.localRoom;
    if (!room || this.gameOverTriggered || !this.running) return;

    const myPlayer = room.players[this.mysocketid!];
    if (!myPlayer) return;

    // 1. Loss — our player died.
    if (!myPlayer.alive) {
      this.gameOverTriggered = true;
      this.post?.flash(1);
      this._triggerSoloGameOver(false);
      return;
    }

    // 2. Win — every enemy (non-self entry) is dead.
    const anyEnemyAlive = Object.entries(room.players).some(
      ([socketid, p]) => socketid !== this.mysocketid && p.alive
    );
    if (this.initialBotCount > 0 && !anyEnemyAlive) {
      this.gameOverTriggered = true;
      this._triggerSoloGameOver(true);
    }
  }

  // Snapshot the current room poses (by entity id) into the interpolation
  // buffer, shifting the previous current into prev.
  _captureSolo() {
    const room = this.localRoom;
    if (!room) return;
    this.soloPrev = this.soloCurr;

    const players: Record<string, Pose> = {};
    for (const id in room.players) {
      players[id] = poseOf(room.players[id]!);
    }
    const bullets: Record<number, Pose> = {};
    for (const b of room.bullets as unknown as RenderBullet[]) {
      if (b.id !== undefined) bullets[b.id] = poseOf(b);
    }
    const mines: Record<number, Pose> = {};
    for (const m of room.mines as unknown as RenderMine[]) {
      if (m.id !== undefined) mines[m.id] = poseOf(m);
    }
    this.soloCurr = { players, bullets, mines };
  }

  // Copy the Room's strictly-typed entity arrays into the engine's
  // render-shaped fields. The runtime's Player/Bullet/Mine are richer than the
  // loose render views the engine reads, so they are widened at the boundary.
  private _syncStateFromRoom(room: Room) {
    this.players = room.players as unknown as Record<string, RoomPlayer>;
    this.blocks = room.blocks;
    this.Bcollision = room.Bcollision;
    this.bullets = room.bullets as RenderBullet[];
    this.mines = room.mines as RenderMine[];
    this.holes = room.holes;
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
      // Held touch auto-fire fires every step (server re-gates on bullet count).
      click: input.click || input.firing,
      aim: resolveAim(input, this._localPlayerCenter()),
      room_id: this.roomId,
      mytick: this.tick,
    });
  }

  _onTick(data: RoomSnapshot) {
    this.bullets = data.bullets;
    this.mines = data.mines;
    this.tick = data.tick;
    // Server-tick players are serialized snapshots (no shoot/plant methods); the
    // engine only reads render fields off them, so widen to the loose RoomPlayer
    // map the renderer/state fields expect.
    this.players = data.players as unknown as Record<string, RoomPlayer>;
    this.holes = data.holes;

    // Buffer the timestamped snapshot for render interpolation. The display
    // renders ~INTERP_DELAY_MS in the past so there are always two server states
    // to blend between, hiding network jitter. Keep ~1s of history.
    const now = performance.now();
    this.snapshotBuffer.push({
      t: now,
      state: {
        players: this.players,
        bullets: this.bullets,
        mines: this.mines,
      },
    });
    pruneBuffer(this.snapshotBuffer, now - 1000);

    // Death flash on our player's alive→dead transition; kill pop when our
    // kill count rises. Both read off our entry in the tick snapshot.
    const me = this.mysocketid ? this.players[this.mysocketid] : undefined;
    if (me) {
      if (this.prevMyAlive && me.alive === false) {
        this.post?.flash(1);
      }
      this.prevMyAlive = me.alive !== false; // undefined → treat as alive

      const myKills = me.round_stats?.stats?.kills ?? 0;
      if (myKills > this.prevMyKills) this.post?.killFlash(1);
      this.prevMyKills = myKills;
    }
  }

  _onLevelChange(data: LevelChange) {
    this.blocks = data.blocks;
    this.Bcollision = data.Bcollision;
  }

  // Fire the flying-cannon debris on any tank's alive→dead transition, then
  // refresh the per-player alive snapshot. Works for both solo (room.players)
  // and online (tick snapshot) since both keep dead players in the map with
  // alive=false until they respawn. Position freezes at the death spot because
  // the dead Player skips its movement step.
  _spawnDeathDebris() {
    const next: Record<string, boolean> = {};
    for (const id in this.players) {
      const p = this.players[id] as unknown as {
        alive?: boolean;
        position?: { x: number; y: number };
        size?: { w: number; h: number };
        angle?: number;
        turretc?: string;
      };
      const alive = p.alive !== false; // undefined → treat as alive
      next[id] = alive;

      // Fire only on a real alive→dead transition we actually witnessed: require
      // the player to have been seen ALIVE last frame. A player first observed
      // already-dead (e.g. joining mid-round) has no prior entry and is skipped,
      // so we don't spew cannons for tanks that died before we were watching.
      const wasAlive = this.prevAlive[id] === true;
      if (wasAlive && !alive && p.position && p.size) {
        const w = p.size.w;
        const h = p.size.h;
        this.debris.spawnCannon({
          cx: p.position.x + w / 2,
          cy: p.position.y + h / 2,
          // Same hull radius the Renderer scales the live tank from.
          r: Math.min(w, h) * 0.46,
          // Renderer draws the barrel at player.angle + PI, so launch to match.
          barrelAngle: (p.angle ?? 0) + Math.PI,
          turretColor: p.turretc ?? "none",
        });
      }
    }
    this.prevAlive = next;
  }

  // Interpolate one entity between an older (`a`) and newer (`b`) snapshot. The
  // newer snapshot is the source of truth for membership and all non-pose
  // fields; only position/angle are blended. Loose render types carry `unknown`
  // positions, so we cross the Posable boundary with explicit casts here.
  private _lerpEntity<T>(a: T | undefined, b: T, alpha: number): T {
    if (a === undefined) return b;
    const pose = lerpPose(
      poseOf(a as unknown as Posable),
      poseOf(b as unknown as Posable),
      alpha
    );
    return withPose(b as unknown as Posable, pose) as unknown as T;
  }

  // Build the interpolated solo entities: live room entities placed at a pose
  // blended between the previous and current captured sim step.
  private _interpolatedSolo(alpha: number) {
    const room = this.localRoom;
    if (!room) {
      return {
        players: this.players,
        bullets: this.bullets,
        mines: this.mines,
      };
    }
    const prev = this.soloPrev;
    const curr = this.soloCurr;

    const players: Record<string, RoomPlayer> = {};
    for (const id in room.players) {
      const p = room.players[id]!;
      const cp = curr?.players[id];
      const pp = prev?.players[id];
      const pose = pp && cp ? lerpPose(pp, cp, alpha) : (cp ?? poseOf(p));
      players[id] = withPose(
        p as unknown as Posable,
        pose
      ) as unknown as RoomPlayer;
    }
    const bullets = (room.bullets as unknown as RenderBullet[]).map((b) => {
      const cp = b.id !== undefined ? curr?.bullets[b.id] : undefined;
      const pp = b.id !== undefined ? prev?.bullets[b.id] : undefined;
      const pose = pp && cp ? lerpPose(pp, cp, alpha) : (cp ?? poseOf(b));
      return withPose(b as unknown as Posable, pose) as unknown as RenderBullet;
    });
    const mines = (room.mines as unknown as RenderMine[]).map((m) => {
      const cp = m.id !== undefined ? curr?.mines[m.id] : undefined;
      const pp = m.id !== undefined ? prev?.mines[m.id] : undefined;
      const pose = pp && cp ? lerpPose(pp, cp, alpha) : (cp ?? poseOf(m));
      return withPose(m as unknown as Posable, pose) as unknown as RenderMine;
    });
    return { players, bullets, mines };
  }

  // Build the interpolated online entities from the snapshot buffer, rendering
  // INTERP_DELAY_MS in the past so two server states always straddle the render
  // time. Falls back to the latest snapshot when the buffer is too short.
  private _interpolatedOnline() {
    const fallback = {
      players: this.players,
      bullets: this.bullets,
      mines: this.mines,
    };
    const renderTime = performance.now() - INTERP_DELAY_MS;
    const sample = sampleBuffer(this.snapshotBuffer, renderTime);
    if (!sample) return fallback;
    const { a, b, alpha } = sample;

    const players: Record<string, RoomPlayer> = {};
    for (const id in b.state.players) {
      players[id] = this._lerpEntity(
        a.state.players[id],
        b.state.players[id]!,
        alpha
      );
    }
    const bullets = b.state.bullets.map((bb) => {
      const ab =
        bb.id !== undefined
          ? a.state.bullets.find((x) => x.id === bb.id)
          : undefined;
      return this._lerpEntity(ab, bb, alpha);
    });
    const mines = b.state.mines.map((bm) => {
      const am =
        bm.id !== undefined
          ? a.state.mines.find((x) => x.id === bm.id)
          : undefined;
      return this._lerpEntity(am, bm, alpha);
    });
    return { players, bullets, mines };
  }

  // The display loop: draw the world at the interpolated positions for this
  // render frame. Particle/debris/post effects are unchanged; only the entity
  // positions handed to the renderer are interpolated.
  _render(alpha: number) {
    const { players, bullets, mines } =
      this.mode === "solo"
        ? this._interpolatedSolo(alpha)
        : this._interpolatedOnline();

    // Update particles
    this.particles.update();

    // Spawn a flying cannon for any tank that died since last frame, then step
    // the debris physics against the level walls.
    this._spawnDeathDebris();
    this.debris.update(
      this.Bcollision as Parameters<DebrisSystem["update"]>[0]
    );

    // Trigger fast bullet particles (Rocket trails)
    bullets.forEach((bullet) => {
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

    // Round-start parachute drop: progress 0→1 over SPAWN_ANIM_MS, or undefined
    // once finished / inactive so the renderer draws tanks normally.
    const spawnAnim =
      this.spawnAnimElapsed !== null
        ? { progress: clamp(this.spawnAnimElapsed / SPAWN_ANIM_MS, 0, 1) }
        : undefined;

    // Render game state. The engine holds these entities loosely (server- or
    // Room-shaped); the Renderer's GameState describes the same shapes, so cast.
    this.renderer.draw({
      mines: mines,
      holes: this.holes,
      blocks: this.blocks,
      Bcollision: this.Bcollision,
      bullets: bullets,
      players: players,
      spawnAnim: spawnAnim,
    } as unknown as Parameters<typeof this.renderer.draw>[0]);

    // Flying cannon debris sits above the wrecks/tanks but below the spark
    // particles. Drawn on the renderer's 2D context so post-processing (bloom)
    // picks it up alongside everything else.
    this.debris.draw(this.renderer.c);

    // Render particles
    this.particles.draw(this.renderer.c);

    // Post-process: upload the 2D layers as textures and run the WebGL effect
    // chain (shockwave + bloom), presenting on the GL canvas. When post is
    // null this is skipped and the 2D canvases are what the user sees.
    if (this.post) {
      this.post.render(
        this.renderer.canvas,
        this.blocks as EnvBlock[],
        this.holes as EnvHole[]
      );
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.oldTime = performance.now();
    // Discard any wall-clock time that elapsed while paused.
    this.simAccumulator = 0;
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
    this.debris.clear();
    this.prevAlive = {};
    this.spawnAnimElapsed = null;
    this.sounds.clear();

    // Release WebGL resources / drop the context.
    if (this.post) {
      this.post.dispose();
      this.post = null;
    }

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
        (myPlayer?.round_stats?.stats as Record<string, number> | undefined) ||
        {};

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

  // True when the WebGL post-processing layer initialised, so the React layer
  // can show the GL canvas and hide the raw 2D canvases.
  hasPostProcessing(): boolean {
    return this.post !== null;
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

  // Apply the user's effect toggles to the live systems. Keybindings are
  // applied globally by the SettingsContext (InputHandler.applyKeyBindings),
  // so they're not threaded through here. Safe to call repeatedly (on engine
  // creation and whenever settings change mid-game).
  applyEffects(effects: EffectSettings) {
    this.particles.setEnabled(effects.particles);
    this.debris.setEnabled(effects.particles);
    this.sounds.setEnabled(effects.sound);
    this.post?.setEffects(effects);
  }
}
