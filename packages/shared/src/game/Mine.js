export class Mine {
  constructor(position, emitter, room) {
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

  update(fps_corector) {
    this.timealive += fps_corector;
  }
}
