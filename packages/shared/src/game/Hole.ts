import type { Vec2, Size } from "./types.js";

export class Hole {
  position: Vec2;
  size: Size;

  constructor(position: Vec2) {
    this.position = position;
    this.size = {
      w: 50,
      h: 50,
    };
  }
}
