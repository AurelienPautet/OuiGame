// Round-start spawn animation: a flag is planted on each tank's spawn point and
// the tank parachutes down onto it during the countdown. Drawn in the same
// flat-fill + thick-ink-outline "diep.io arcade" style as the rest of the game
// (see tankShape.ts / shapes.ts) so it sits seamlessly on the field.
import { palette, tankColors } from "../theme/palette";
import { drawTank } from "./tankShape";
import { clamp } from "./interpolation";

const INK = palette.ink;

// Fraction of the whole animation at which the tank touches down on its flag.
// The remaining time leaves the tank sitting on its spot before "GO".
const LAND_T = 0.78;
// How high above its spawn the tank starts the drop, in hull radii.
const DROP_RADII = 17;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export interface DrawSpawnTankOpts {
  /** hull centre = the tank's final (spawn) position */
  cx: number;
  cy: number;
  /** hull radius (everything scales from this) */
  r: number;
  bodyColor: string;
  turretColor: string;
  /** barrel direction in radians (already +PI calibrated by the caller) */
  angle: number;
  isBot?: boolean;
  /** 0..1 progress over the whole spawn animation */
  progress: number;
}

// Draw a tank mid-spawn: its planted flag, the descending (or just-landed) tank,
// its parachute, and the touchdown dust. `progress` runs 0→1 over the countdown.
export function drawSpawnTank(
  c: CanvasRenderingContext2D,
  o: DrawSpawnTankOpts
): void {
  const { cx, cy, r, bodyColor, turretColor, angle, isBot } = o;
  const body = tankColors(bodyColor);
  // Invisible tanks (spectator / "none") get no flag or chute either.
  if (body.fill === "transparent") return;

  const progress = clamp(o.progress, 0, 1);
  const descent = clamp(progress / LAND_T, 0, 1); // 0 = high up, 1 = touched down
  const landed = progress >= LAND_T;
  const after = landed ? (progress - LAND_T) / (1 - LAND_T) : 0; // 0..1 post-land

  const eased = easeOutCubic(descent);
  // Gentle pendulum sway that settles to nothing as the chute nears the ground.
  const swing = Math.sin(progress * 9) * (1 - eased);
  const tx = landed ? cx : cx + swing * r * 0.7;
  const ty = landed ? cy : cy - r * DROP_RADII * (1 - eased);

  // The flag marks the landing spot for the whole animation, and the touchdown
  // dust sits on the ground — both drawn before the tank so it lands in front.
  drawLandingFlag(c, cx, cy, r, body.fill);
  if (landed) drawDustRing(c, cx, cy, r, after);

  // While descending, the canopy is above (behind) the tank, swaying with the
  // pendulum; drawn before the hull so the shroud-line tops tuck under it.
  if (!landed) drawParachute(c, tx, ty, r, body.fill, swing * 0.18, 1);

  drawTank(c, {
    cx: tx,
    cy: ty,
    r,
    bodyColor,
    turretColor,
    angle,
    isBot: !!isBot,
  });

  // After landing, the cut-away canopy drifts up and fades out above the tank.
  if (landed && after < 0.85) {
    const rise = r * 6 * easeOutCubic(after);
    drawParachute(c, cx, cy - rise, r, body.fill, 0.25, 1 - after / 0.85);
  }
}

// A pennant on an ink pole, planted just beside the spawn point. The pennant
// takes the tank's body colour so it reads as "your" spot.
function drawLandingFlag(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string
): void {
  const baseX = cx - r * 0.95;
  const baseY = cy + r * 0.5;
  const topY = cy - r * 1.7;
  c.save();
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = INK;

  // Pole.
  c.lineWidth = Math.max(2, r * 0.16);
  c.beginPath();
  c.moveTo(baseX, baseY);
  c.lineTo(baseX, topY);
  c.stroke();

  // Triangular pennant.
  c.beginPath();
  c.moveTo(baseX, topY);
  c.lineTo(baseX + r * 1.5, topY + r * 0.45);
  c.lineTo(baseX, topY + r * 0.9);
  c.closePath();
  c.fillStyle = fill;
  c.lineWidth = Math.max(2, r * 0.14);
  c.fill();
  c.stroke();
  c.restore();
}

// A segmented umbrella canopy with shroud lines converging on a harness point
// near the top of the tank. `tilt` rotates the whole rig about the harness for a
// natural pendulum look; `alpha` fades it out when it detaches after landing.
function drawParachute(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  tilt: number,
  alpha: number
): void {
  if (alpha <= 0) return;
  const W = r * 2.4; // canopy half-width
  const rimY = -r * 3.4; // canopy rim height above the harness
  const domeH = r * 1.7; // dome height above the rim

  c.save();
  c.globalAlpha = alpha;
  // Harness sits just above the tank centre; rotate the rig about it.
  c.translate(x, y - r * 0.55);
  c.rotate(tilt);
  c.lineJoin = "round";
  c.lineCap = "round";
  c.strokeStyle = INK;

  // Shroud lines (drawn first so the canopy overlaps their tops).
  c.lineWidth = Math.max(1.5, r * 0.09);
  for (const sx of [-W, -W * 0.5, W * 0.5, W]) {
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(sx, rimY);
    c.stroke();
  }

  // Canopy: top dome + scalloped bottom rim.
  c.beginPath();
  c.ellipse(0, rimY, W, domeH, 0, Math.PI, 2 * Math.PI);
  const seg = 4;
  for (let i = 0; i < seg; i++) {
    const x0 = W - 2 * W * (i / seg);
    const x1 = W - 2 * W * ((i + 1) / seg);
    c.quadraticCurveTo((x0 + x1) / 2, rimY + r * 0.5, x1, rimY);
  }
  c.closePath();
  c.fillStyle = fill;
  c.lineWidth = Math.max(2, r * 0.16);
  c.fill();
  c.stroke();

  // Panel seams from the dome apex out to the rim.
  c.lineWidth = Math.max(1, r * 0.08);
  const apexY = rimY - domeH;
  for (const sx of [-W * 0.6, 0, W * 0.6]) {
    c.beginPath();
    c.moveTo(0, apexY);
    c.lineTo(sx, rimY);
    c.stroke();
  }

  c.restore();
}

// An expanding, fading ring kicked up where the tank hits the ground.
function drawDustRing(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  after: number
): void {
  if (after >= 1) return;
  const ringR = r * (0.5 + after * 1.9);
  c.save();
  c.globalAlpha = (1 - after) * 0.7;
  c.strokeStyle = palette.inkSoft;
  c.lineWidth = Math.max(2, r * 0.2 * (1 - after));
  c.beginPath();
  c.arc(cx, cy + r * 0.6, ringR, 0, Math.PI * 2);
  c.stroke();
  c.restore();
}
