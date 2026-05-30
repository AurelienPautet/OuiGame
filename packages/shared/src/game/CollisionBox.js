export class CollisionBox {
  constructor(position, size) {
    this.position = position;
    this.size = size;
  }
  // Debug-only outline. The canvas context + debug colour are passed in (they
  // used to be browser window globals); the live client draws collision boxes
  // via the Renderer, so this is currently unused but kept de-globalized so it
  // never reaches for a global again.
  draw(c, debug) {
    c.strokeStyle = debug;
    c.rect(this.position.x, this.position.y, this.size.w, this.size.h);
    c.strokeStyle = "black";
    c.strokeRect(this.position.x, this.position.y, this.size.w, this.size.h);
  }
}

export { CollisionBox as CollisonsBox };
