import type { Vec2, Size } from "./types.js";

export class Block {
  position: Vec2;
  size: Size;
  type: number;

  constructor(position: Vec2, type: number) {
    this.position = position;
    this.size = {
      w: 50,
      h: 50,
    };
    this.type = type;
  }
}
