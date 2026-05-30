export function rectRect(r1x, r1y, r1w, r1h, r2x, r2y, r2w, r2h) {
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

export function detectCollision(rect1, rect2, velocity1) {
  // Vérifier s'il position.y a une collision
  if (
    rect1.position.x + velocity1.x + velocity1.x <
      rect2.position.x + rect2.size.w &&
    rect1.position.x + velocity1.x + rect1.size.w > rect2.position.x &&
    rect1.position.y + velocity1.y < rect2.position.y + rect2.size.h &&
    rect1.position.y + velocity1.y + rect1.size.h > rect2.position.y
  ) {
    // Calculer les distances entre les bords des rectangles
    let overlapLeft = rect2.position.x + rect2.size.w - rect1.position.x;
    let overlapRight =
      rect1.position.x + velocity1.x + rect1.size.w - rect2.position.x;
    let overlapTop =
      rect2.position.y + rect2.size.h - rect1.position.y + velocity1.y;
    let overlapBottom =
      rect1.position.y + velocity1.y + rect1.size.h - rect2.position.y;

    // Déterminer le côté de collision en trouvant la plus petite distance de chevauchement
    let minOverlap = Math.min(
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
  rect1t,
  rect1l,
  rect1w,
  rect1h,
  rect2t,
  rect2l,
  rect2w,
  rect2h,
  offset
) {
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

export function distance(position1, size1, position2, size2) {
  return (
    (position1.x + size1.w / 2 - position2.x - size2.w / 2) ** 2 +
    (position1.y + size1.h / 2 - position2.y - size2.h / 2) ** 2
  );
}

export function rectanglesSeTouchent(
  x1,
  y1,
  width1,
  height1,
  x2,
  y2,
  width2,
  height2
) {
  // Vérifier les conditions d'intersection directe
  const horizontale = x1 < x2 + width2 && x1 + width1 > x2;
  const verticale = y1 < y2 + height2 && y1 + height1 > y2;

  return horizontale && verticale;
}
