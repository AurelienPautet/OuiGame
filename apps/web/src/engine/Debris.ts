/**
 * Debris - physics-driven wreck pieces.
 *
 * When a tank is destroyed its CANNON snaps off and tumbles across the arena,
 * bouncing off the same walls (`Bcollision`) the bullets do, slowing under
 * ground friction until it settles — then it stays put. Pieces are never culled
 * on their own; they litter the field until the system is cleared (quit / level
 * change / effects off). This is a purely client-side cosmetic: it reads the
 * dead player's turret colour + barrel angle off the snapshot and simulates from
 * there. The burnt-out hull husk is drawn by `Renderer._drawWreck`; this module
 * owns only the flying barrel.
 *
 * Top-down arena ⇒ no gravity. The "physics" is linear motion + axis-separated
 * AABB wall bounces + drag, which reads as a part skittering across the floor.
 */
import { palette, tankColors, wreckFill } from "../theme/palette";

const INK = palette.ink;

interface Wall {
  position: { x: number; y: number };
  size: { w: number; h: number };
}

// --- Tuning ---
const RESTITUTION = 0.6; // fraction of speed kept after a wall bounce
const FRICTION = 0.97; // per-frame linear drag (the "floor")
const SPIN_DAMP = 0.96; // per-frame angular drag
const REST_SPEED = 0.18; // below this the piece settles to rest

export interface SpawnCannonOpts {
  /** tank centre (where the barrel breaks off) */
  cx: number;
  cy: number;
  /** hull radius the barrel geometry scales from (same r the Renderer uses) */
  r: number;
  /** world-space barrel direction in radians (Renderer's player.angle + PI) */
  barrelAngle: number;
  /** turret colour NAME (resolved through tankColors, like the live tank) */
  turretColor: string;
}

// A single barrel that has broken off a destroyed tank.
class CannonDebris {
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  len: number;
  baseW: number;
  tipW: number;
  half: number; // half-extent of the square AABB used for wall collision
  fill: string;
  resting = false;

  constructor(o: SpawnCannonOpts) {
    const r = o.r;
    // Barrel geometry mirrors tankShape.drawTank so the flying piece matches the
    // barrel that was on the tank a frame ago.
    this.baseW = r * 0.62;
    this.tipW = r * 0.54;
    this.len = r * 1.25;
    this.half = r * 0.42;
    // Charred to the SAME darkness as the wreck hull (wreckFill / WRECK_CHAR) so
    // the barrel that flew off reads as the same burnt material as the body it
    // left behind.
    this.fill = wreckFill(o.turretColor);

    this.cx = o.cx;
    this.cy = o.cy;
    this.rot = o.barrelAngle;

    // Fly off roughly the way the barrel pointed, with a wide blast spread so
    // each death looks a little different.
    const spread = (Math.random() - 0.5) * 1.8; // ±~50°
    const dir = o.barrelAngle + spread;
    const speed = 2.25 + Math.random() * 1.5;
    this.vx = Math.cos(dir) * speed;
    this.vy = Math.sin(dir) * speed;

    // Always tumble: random spin with a guaranteed minimum magnitude.
    const s = 0.12 + Math.random() * 0.28;
    this.spin = Math.random() < 0.5 ? -s : s;
  }

  // Square-AABB overlap test against a wall rect.
  private _hits(w: Wall): boolean {
    return (
      this.cx - this.half < w.position.x + w.size.w &&
      this.cx + this.half > w.position.x &&
      this.cy - this.half < w.position.y + w.size.h &&
      this.cy + this.half > w.position.y
    );
  }

  update(walls: Wall[]): void {
    if (this.resting) return;

    // Axis-separated resolution: move on X, push out of any wall hit and flip
    // vx; then the same on Y. Decoupling the axes avoids corner ambiguity and
    // keeps the piece inside the arena even against the perimeter walls.
    this.cx += this.vx;
    for (const w of walls) {
      if (!this._hits(w)) continue;
      if (this.vx > 0) this.cx = w.position.x - this.half;
      else if (this.vx < 0) this.cx = w.position.x + w.size.w + this.half;
      this.vx = -this.vx * RESTITUTION;
      this.spin = this.spin * 0.7 + this.vx * 0.03;
    }

    this.cy += this.vy;
    for (const w of walls) {
      if (!this._hits(w)) continue;
      if (this.vy > 0) this.cy = w.position.y - this.half;
      else if (this.vy < 0) this.cy = w.position.y + w.size.h + this.half;
      this.vy = -this.vy * RESTITUTION;
      this.spin = this.spin * 0.7 + this.vy * 0.03;
    }

    this.rot += this.spin;
    this.vx *= FRICTION;
    this.vy *= FRICTION;
    this.spin *= SPIN_DAMP;

    // Settle: once it's barely moving, stop and let the spin wind down to rest.
    if (Math.hypot(this.vx, this.vy) < REST_SPEED) {
      this.vx = 0;
      this.vy = 0;
      this.spin *= 0.6;
      if (Math.abs(this.spin) < 0.005) {
        this.spin = 0;
        this.resting = true;
      }
    }
  }

  draw(c: CanvasRenderingContext2D): void {
    c.save();
    c.translate(this.cx, this.cy);
    c.rotate(this.rot);
    c.lineJoin = "round";

    // Tapered barrel, centred on its own midpoint so it tumbles about its centre
    // of mass instead of pivoting around one end.
    const h = this.len / 2;
    c.beginPath();
    c.moveTo(-h, -this.baseW / 2);
    c.lineTo(h, -this.tipW / 2);
    c.lineTo(h, this.tipW / 2);
    c.lineTo(-h, this.baseW / 2);
    c.closePath();
    c.fillStyle = this.fill;
    c.lineWidth = this.baseW * 0.34;
    c.strokeStyle = INK;
    c.fill();
    c.stroke();

    c.restore();
  }
}

/** Owns and simulates every flying cannon piece currently on the field. */
export class DebrisSystem {
  pieces: CannonDebris[] = [];
  // Mirrors ParticleSystem: when false, no debris spawns and any live pieces are
  // dropped. Driven by the "particles" effect setting.
  enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  clear(): void {
    this.pieces = [];
  }

  /** Break the cannon off a just-destroyed tank and launch it. */
  spawnCannon(o: SpawnCannonOpts): void {
    if (!this.enabled) return;
    // Invisible ("none") tanks have a transparent turret — nothing to throw.
    if (tankColors(o.turretColor).fill === "transparent") return;
    this.pieces.push(new CannonDebris(o));
  }

  update(walls: Wall[]): void {
    // Pieces are never removed here — once they settle they stay on the field.
    // The whole set is dropped together by clear() (quit / level change).
    for (const p of this.pieces) p.update(walls);
  }

  draw(c: CanvasRenderingContext2D): void {
    for (const p of this.pieces) p.draw(c);
  }
}
