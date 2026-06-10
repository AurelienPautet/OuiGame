// Single source of truth for the tank SHAPE, drawn to a 2D canvas. Both the
// in-game Renderer and the menu <TankAvatar> call this, so the tank looks
// pixel-identical everywhere (Home, Tank-Select, Profile, Rankings, in-game).
//
// Clean diep.io silhouette: a flat circular hull with a single barrel poking
// out toward the aim direction, both with a thick dark outline. No treads, no
// gear hub — that clutter is what made earlier versions read like a cog.
import { palette, tankColors, desaturateHex } from "../theme/palette";

const INK = palette.ink;

export interface DrawTankOpts {
  /** hull centre */
  cx: number;
  cy: number;
  /** hull radius (everything scales from this) */
  r: number;
  /** body colour NAME (see constants/tankColors) */
  bodyColor: string;
  /** barrel colour NAME */
  turretColor: string;
  /** barrel direction in radians (0 = pointing right) */
  angle: number;
  /** draw the AI marker dot */
  isBot?: boolean;
  /**
   * Loaded-ammo fraction (0..1) used as a hull ammo gauge: 1 → full team hue,
   * 0 → washed-out grey (every shot in flight). Only the hull fill drains; the
   * barrel and ink outline stay coloured so team identity survives at empty.
   * Omitted (default 1) for menu avatars, which always show full colour.
   */
  ammoFraction?: number;
}

// How far the barrel tip reaches from the hull centre, in units of r. Callers
// size their viewport with this so the barrel never clips.
export const TANK_REACH = 1.55;

export function drawTank(c: CanvasRenderingContext2D, o: DrawTankOpts): void {
  const { cx, cy, r, angle, isBot } = o;
  const body = tankColors(o.bodyColor);
  const turret = tankColors(o.turretColor);
  if (body.fill === "transparent") return;

  c.save();
  c.lineJoin = "round";
  c.strokeStyle = INK;

  // Barrel — drawn first so its base tucks under the hull and only the
  // protruding length shows. A touch tapered toward the muzzle.
  const baseW = r * 0.62;
  const tipW = r * 0.54;
  const len = r * TANK_REACH;
  c.save();
  c.translate(cx, cy);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(0, -baseW / 2);
  c.lineTo(len, -tipW / 2);
  c.lineTo(len, tipW / 2);
  c.lineTo(0, baseW / 2);
  c.closePath();
  c.fillStyle = turret.fill;
  c.lineWidth = r * 0.2;
  c.fill();
  c.stroke();
  c.restore();

  // Hull — its fill drains toward grey as the tank empties its magazine.
  const ammo = o.ammoFraction ?? 1;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = ammo >= 1 ? body.fill : desaturateHex(body.fill, 1 - ammo);
  c.lineWidth = r * 0.22;
  c.fill();
  c.stroke();

  // Bots get a small dark centre dot so they read as AI at a glance.
  if (isBot) {
    c.beginPath();
    c.arc(cx, cy, r * 0.26, 0, Math.PI * 2);
    c.fillStyle = INK;
    c.fill();
  }

  c.restore();
}
