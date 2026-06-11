import type { Vec2, Size } from "./types.js";

// A side returned by the collision helpers: "" means no collision.
export type CollisionSide = "" | "left" | "right" | "up" | "down";

// The minimal axis-aligned box the object-based detectCollision reads.
interface CollisionRect {
  position: Vec2;
  size: Size;
}

export function rectRect(
  r1x: number,
  r1y: number,
  r1w: number,
  r1h: number,
  r2x: number,
  r2y: number,
  r2w: number,
  r2h: number
): boolean {
  // are the sides of one rectangle touching the other?

  if (
    r1x + r1w >= r2x && // r1 right edge past r2 left
    r1x <= r2x + r2w && // r1 left edge past r2 right
    r1y + r1h >= r2y && // r1 top edge past r2 bottom
    r1y <= r2y + r2h
  ) {
    return true;
  }
  return false;
}

export function detectCollision(
  rect1: CollisionRect,
  rect2: CollisionRect,
  velocity1: Vec2
): CollisionSide {
  // Swept position of rect1 (its leading edges after applying velocity).
  const x1 = rect1.position.x + velocity1.x;
  const y1 = rect1.position.y + velocity1.y;
  const w1 = rect1.size.w;
  const h1 = rect1.size.h;
  const x2 = rect2.position.x;
  const y2 = rect2.position.y;
  const w2 = rect2.size.w;
  const h2 = rect2.size.h;

  // No overlap between the swept rect1 and rect2 → no collision.
  if (!(x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2)) {
    return "";
  }

  // Minimum-translation overlap on each side; the smallest one is the contact
  // face. (Symmetric — the previous version double-applied velocity on the left
  // edge and mis-parenthesised the top overlap.)
  const overlapLeft = x2 + w2 - x1;
  const overlapRight = x1 + w1 - x2;
  const overlapTop = y2 + h2 - y1;
  const overlapBottom = y1 + h1 - y2;

  const minOverlap = Math.min(
    overlapLeft,
    overlapRight,
    overlapTop,
    overlapBottom
  );

  if (minOverlap === overlapLeft) {
    return "left";
  } else if (minOverlap === overlapRight) {
    return "right";
  } else if (minOverlap === overlapTop) {
    return "up";
  } else {
    return "down";
  }
}

export function colliderect(
  rect1t: number,
  rect1l: number,
  rect1w: number,
  rect1h: number,
  rect2t: number,
  rect2l: number,
  rect2w: number,
  rect2h: number,
  offset: number
): CollisionSide {
  /* collide up */
  if (
    (rect1t - offset < rect2t + rect2h &&
      rect1t - offset > rect2t &&
      rect1l < rect2l + rect2w &&
      rect1l > rect2l) ||
    (rect1t - offset < rect2t + rect2h &&
      rect1t - offset > rect2t &&
      rect1l + rect1w / 2 < rect2l + rect2w &&
      rect1l + rect1w / 2 > rect2l) ||
    (rect1t - offset < rect2t + rect2h &&
      rect1t - offset > rect2t &&
      rect1l + rect1w < rect2l + rect2w &&
      rect1l + rect1w > rect2l)
  ) {
    return "up";
  }
  /* collide down */
  if (
    (rect1t + offset + rect1h < rect2t + rect2h &&
      rect1t + offset + rect1h > rect2t &&
      rect1l < rect2l + rect2w &&
      rect1l > rect2l) ||
    (rect1t + offset + rect1h < rect2t + rect2h &&
      rect1t + offset + rect1h > rect2t &&
      rect1l + rect1w / 2 < rect2l + rect2w &&
      rect1l + rect1w / 2 > rect2l) ||
    (rect1t + offset + rect1h < rect2t + rect2h &&
      rect1t + offset + rect1h > rect2t &&
      rect1l + rect1w < rect2l + rect2w &&
      rect1l + rect1w > rect2l)
  ) {
    return "down";
  }
  /* collide left */
  if (
    (rect1t < rect2t + rect2h &&
      rect1t > rect2t &&
      rect1l - offset < rect2l + rect2w &&
      rect1l - offset > rect2l) ||
    (rect1t + rect1h / 2 < rect2t + rect2h &&
      rect1t + rect1h / 2 > rect2t &&
      rect1l - offset < rect2l + rect2w &&
      rect1l - offset > rect2l) ||
    (rect1t + rect1h < rect2t + rect2h &&
      rect1t + rect1h > rect2t &&
      rect1l - offset < rect2l + rect2w &&
      rect1l - offset > rect2l)
  ) {
    return "left";
  }

  /* collide right */
  if (
    (rect1t < rect2t + rect2h &&
      rect1t > rect2t &&
      rect1l + offset + rect1w < rect2l + rect2w &&
      rect1l + offset + rect1w > rect2l) ||
    (rect1t + rect1h / 2 < rect2t + rect2h &&
      rect1t + rect1h / 2 > rect2t &&
      rect1l + offset + rect1w < rect2l + rect2w &&
      rect1l + offset + rect1w > rect2l) ||
    (rect1t + rect1h < rect2t + rect2h &&
      rect1t + rect1h > rect2t &&
      rect1l + offset + rect1w < rect2l + rect2w &&
      rect1l + offset + rect1w > rect2l)
  ) {
    return "right";
  }
  return "";
}

export function distance(
  position1: Vec2,
  size1: Size,
  position2: Vec2,
  size2: Size
): number {
  return (
    (position1.x + size1.w / 2 - position2.x - size2.w / 2) ** 2 +
    (position1.y + size1.h / 2 - position2.y - size2.h / 2) ** 2
  );
}

export function rectanglesSeTouchent(
  x1: number,
  y1: number,
  width1: number,
  height1: number,
  x2: number,
  y2: number,
  width2: number,
  height2: number
): boolean {
  // Vérifier les conditions d'intersection directe
  const horizontale = x1 < x2 + width2 && x1 + width1 > x2;
  const verticale = y1 < y2 + height2 && y1 + height1 > y2;

  return horizontale && verticale;
}

// ---------------------------------------------------------------------------
// Circle-based collision
//
// Tanks and bullets are *drawn* as circles, so they now *collide* as circles
// too — the hitbox matches exactly what the player sees, with no invisible box
// corners sticking out past the round hull. Tanks collide as the hull disc the
// renderer draws (min(side) * TANK_HULL_RADIUS_FACTOR); bullets collide as their
// on-screen disc (min(side) / 2). Centres are taken from the box centre
// (position + size/2), so the rest of the runtime can keep storing a top-left
// `position` + `size` unchanged.
// ---------------------------------------------------------------------------

// The tank hull radius as a fraction of its box side. This is the disc the tank
// collides as (Player.collisionRadius). It deliberately equals the renderer's
// hull radius factor (HULL_RADIUS_FACTOR in apps/web Renderer/GameEngine) so the
// hitbox matches the drawn hull; keep the two in sync if either changes. (The
// web keeps its own literal rather than importing this, so the web unit tests
// stay hermetic and don't require the shared package to be built first.)
export const TANK_HULL_RADIUS_FACTOR = 0.46;

// Do two circles overlap (touching counts, matching the old inclusive rectRect)?
export function circlesOverlap(
  c1x: number,
  c1y: number,
  r1: number,
  c2x: number,
  c2y: number,
  r2: number
): boolean {
  const dx = c1x - c2x;
  const dy = c1y - c2y;
  const rr = r1 + r2;
  return dx * dx + dy * dy <= rr * rr;
}

// Minimum-translation ejection of a circle out of an axis-aligned rect. Returns
// the circle's corrected centre when it overlaps, or null when it is clear. The
// closest point on the rect gives the contact normal; when the centre is *inside*
// the rect (no closest-point direction), it ejects along the shallowest face.
export function resolveCircleRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): Vec2 | null {
  const qx = Math.max(rx, Math.min(cx, rx + rw));
  const qy = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - qx;
  const dy = cy - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null; // not touching
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const push = r - d;
    return { x: cx + (dx / d) * push, y: cy + (dy / d) * push };
  }
  // Centre lies inside the rect: eject to the nearest face plus the radius.
  const left = cx - rx;
  const right = rx + rw - cx;
  const top = cy - ry;
  const bottom = ry + rh - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: rx - r, y: cy };
  if (m === right) return { x: rx + rw + r, y: cy };
  if (m === top) return { x: cx, y: ry - r };
  return { x: cx, y: ry + rh + r };
}

// Minimum-translation ejection of circle 1 out of circle 2. Returns circle 1's
// corrected centre when they overlap, or null when clear. Only circle 1 is
// moved: each tank resolves against the others in its own update tick, so both
// bodies separate symmetrically over the pair of updates.
export function resolveCircleCircle(
  c1x: number,
  c1y: number,
  r1: number,
  c2x: number,
  c2y: number,
  r2: number
): Vec2 | null {
  const dx = c1x - c2x;
  const dy = c1y - c2y;
  const rr = r1 + r2;
  const d2 = dx * dx + dy * dy;
  if (d2 > rr * rr) return null;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const push = rr - d;
    return { x: c1x + (dx / d) * push, y: c1y + (dy / d) * push };
  }
  // Exactly concentric: eject along +x by the full sum so they fully separate.
  return { x: c1x + rr, y: c1y };
}
