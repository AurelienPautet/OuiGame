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
  // Vérifier s'il position.y a une collision
  if (
    rect1.position.x + velocity1.x + velocity1.x <
      rect2.position.x + rect2.size.w &&
    rect1.position.x + velocity1.x + rect1.size.w > rect2.position.x &&
    rect1.position.y + velocity1.y < rect2.position.y + rect2.size.h &&
    rect1.position.y + velocity1.y + rect1.size.h > rect2.position.y
  ) {
    // Calculer les distances entre les bords des rectangles
    const overlapLeft = rect2.position.x + rect2.size.w - rect1.position.x;
    const overlapRight =
      rect1.position.x + velocity1.x + rect1.size.w - rect2.position.x;
    const overlapTop =
      rect2.position.y + rect2.size.h - rect1.position.y + velocity1.y;
    const overlapBottom =
      rect1.position.y + velocity1.y + rect1.size.h - rect2.position.y;

    // Déterminer le côté de collision en trouvant la plus petite distance de chevauchement
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

  // S'il n't a pas de collision, retourner null
  return "";
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
