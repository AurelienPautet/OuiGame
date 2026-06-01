import type { Vec2 } from "./types.js";
import type { Player } from "./Player.js";
import type { Room } from "./Room.js";

export class Mine {
  position: Vec2;
  radius: number;
  timealive: number;
  color: string;
  emitter: Player;

  constructor(position: Vec2, emitter: Player, room: Room) {
    this.position = position;
    this.radius = 15;
    this.timealive = 0;
    this.color = "yellow";
    this.emitter = emitter;
    this.emitter.round_stats.stats.plants++;
    this.emitter.minecount++;
    room.sounds.plant = true;
    room.mines.push(this);
  }

  update(fps_corector: number): void {
    this.timealive += fps_corector;
  }
}
