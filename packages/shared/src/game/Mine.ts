import { MINE_TRIGGER_RADIUS } from "./game_constants.js";
import type { Vec2 } from "./types.js";
import type { Player } from "./Player.js";
import type { Room } from "./Room.js";

export class Mine {
  // Stable per-mine id, used to match a mine across simulation steps / server
  // snapshots for render interpolation.
  static _nextId = 1;
  id: number;
  position: Vec2;
  radius: number;
  timealive: number;
  color: string;
  emitter: Player;

  constructor(position: Vec2, emitter: Player, room: Room) {
    this.id = Mine._nextId++;
    this.position = position;
    this.radius = MINE_TRIGGER_RADIUS;
    this.timealive = 0;
    this.color = "yellow";
    this.emitter = emitter;
    this.emitter.round_stats.stats.plants++;
    this.emitter.minecount++;
    room.sounds.plant = true;
    room.mines.push(this);
  }

  // `timealive` is counted in fixed simulation ticks (1 tick = SIM_STEP_S). The
  // fuse threshold (Room.timetoeplode) and the renderer's blink/flash thresholds
  // are expressed in the same tick unit, so this advances by exactly one per
  // fixed step.
  update(): void {
    this.timealive += 1;
  }
}
