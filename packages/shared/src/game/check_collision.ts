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
