import { Player } from "../Player.js";
import { ARCHETYPES, type AIBotKind } from "./archetypes.js";
import { Brain, brainTick } from "./brain.js";
import { drawBrainDebug } from "./debug.js";
import { fnv1a } from "./rng.js";
import type { Vec2, DrawingContext } from "../types.js";
import type { Room } from "../Room.js";

// The v2 bot: a Player chassis driven by a brand-new brain, sharing NOTHING
// with the legacy AI (Bot / possible_moves / possible_shots_balls — those stay
// untouched and selectable via Room.bot_system === "legacy").
//
// Wire safety: rooms broadcast `tick` with raw player objects, and socket.io
// serializes every enumerable own property. All AI state therefore lives behind
// ES #private fields (invisible to JSON.stringify / socket.io); the only
// enumerable field added over Player is `kind`. The serialization test pins
// this. For the same reason players must never be structuredClone'd — #private
// state and the prototype would be silently dropped.
export class AIBot extends Player {
  readonly kind: AIBotKind;
  // Per-bot RNG seed: room seed XOR a stable hash of the socketid, so a pinned
  // Room.bot_seed reproduces every bot's behaviour while bots still differ
  // from each other.
  #seed: number;
  #brain: Brain;

  constructor(
    position: Vec2,
    socketid: string,
    name: string,
    turretc: string,
    bodyc: string,
    kind: AIBotKind = "bot1",
    roomSeed = 0
  ) {
    super(position, socketid, name, turretc, bodyc);
    this.kind = kind;
    this.#seed = ((roomSeed >>> 0) ^ fnv1a(socketid)) >>> 0;
    this.#brain = new Brain(this.#seed);

    // Chassis overrides only — same bullets/ammo as the legacy kind; the AI
    // difference is entirely in the brain.
    const chassis = ARCHETYPES[kind].chassis;
    this.mvtspeed = chassis.mvtspeed;
    this.shoot_speed = chassis.shoot_speed;
    this.shoot_max_bounce = chassis.shoot_max_bounce;
    this.bullet_type = chassis.bullet_type;
    this.bullet_size = { w: chassis.bullet_size.w, h: chassis.bullet_size.h };
    this.max_bulletcount = chassis.max_bulletcount;
    this.max_minecount = chassis.max_minecount;
  }

  // Exposed for tests/debug only; getters live on the prototype, so they are
  // not own properties and never serialize.
  get seedForTest(): number {
    return this.#seed;
  }

  get brainForTest(): Brain {
    return this.#brain;
  }

  override update(
    room: Room,
    dt: number,
    ctx?: DrawingContext,
    debug_visual?: boolean
  ): void {
    // Decide BEFORE the chassis integrates: bullets update before players in
    // Room.update, so a dodge chosen here reacts to this tick's positions.
    if (this.alive) {
      brainTick(this, this.kind, this.#brain, room, dt);
      if (ctx && debug_visual) {
        drawBrainDebug(ctx, this, this.kind, this.#brain, room);
      }
    }
    super.update(room, dt);
  }

  // The brain owns this.angle (Player's version would overwrite it from the
  // mouse-aim point, which a bot doesn't have).
  override CalculateAngle(): void {}

  // Round respawn (online respawn_the_room calls spawn() on live instances):
  // restart the brain from its seed so behaviour stays reproducible.
  override spawn(spawn_pos: Vec2): void {
    super.spawn(spawn_pos);
    this.#brain.reset();
  }

  override shoot(room: Room): void {
    super.shoot(room);
    this.#brain.lastShotTick = room.tick;
  }
}
