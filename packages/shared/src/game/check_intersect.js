export function getEdges(rect) {
  const { x, y, w, h } = rect;
  return [
    [
      { x: x, y: y },
      { x: x + w, y: y },
    ],
    [
      { x: x + w, y: y },
      { x: x + w, y: y + h },
    ],
    [
      { x: x + w, y: y + h },
      { x: x, y: y + h },
    ],
    [
      { x: x, y: y + h },
      { x: x, y: y },
    ],
  ];
}

export function intersectRaySegment(rayOrigin, rayDir, p1, p2) {
  //console.log("intersectRaySegment", rayOrigin, rayDir, p1, p2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  const det = -rayDir.x * dy + rayDir.y * dx;
  if (det === 0) return null; //putain de ligne parallèle de con

  const s = (-dy * (p1.x - rayOrigin.x) + dx * (p1.y - rayOrigin.y)) / det;
  const t =
    (rayDir.x * (p1.y - rayOrigin.y) - rayDir.y * (p1.x - rayOrigin.x)) / det;

  if (s >= 0 && t >= 0 && t <= 1) {
    return {
      x: rayOrigin.x + s * rayDir.x,
      y: rayOrigin.y + s * rayDir.y,
      dist: s,
    };
  }
  return null;
}
