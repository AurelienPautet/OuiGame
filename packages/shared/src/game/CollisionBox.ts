import type { Vec2, Size, DrawingContext } from "./types.js";

export class CollisionBox {
  position: Vec2;
  size: Size;

  constructor(position: Vec2, size: Size) {
    this.position = position;
    this.size = size;
  }
  // Debug-only outline. The canvas context + debug colour are passed in (they
  // used to be browser window globals); the live client draws collision boxes
  // via the Renderer, so this is currently unused but kept de-globalized so it
  // never reaches for a global again.
  draw(c: DrawingContext, debug: string): void {
    c.strokeStyle = debug;
    c.rect(this.position.x, this.position.y, this.size.w, this.size.h);
    c.strokeStyle = "black";
    c.strokeRect(this.position.x, this.position.y, this.size.w, this.size.h);
  }
}

export { CollisionBox as CollisonsBox };
