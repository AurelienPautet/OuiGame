// Shared SVG scene primitives for OuiTank marketing assets. Reproduces the
// in-game tank silhouette (apps/web/src/engine/tankShape.ts) with extra polish
// (shading, drop shadows) for stills and the animated GIF.

export const P = {
  blue: "#00b2e1",
  blueD: "#0085a8",
  red: "#f14e54",
  redD: "#b8383d",
  green: "#00e06a",
  greenD: "#00a64e",
  yellow: "#ffe869",
  yellowD: "#c9b53f",
  purple: "#bf7ff5",
  purpleD: "#9355c9",
  orange: "#ffb142",
  orangeD: "#c98821",
  teal: "#2dd4bf",
  tealD: "#1c9c8d",
  ink: "#2b2f36",
  inkSoft: "#555b66",
  field: "#c9cdd2",
  fieldLine: "#b8bdc4",
  panelDark: "#1f232a",
  white: "#fff",
};
export const INK = P.ink;

// Reusable <defs> (hull highlight + soft shadow blur). Included once per doc.
const DEFS = `
  <defs>
    <radialGradient id="hi" gradientUnits="objectBoundingBox" cx="0.35" cy="0.30" r="0.75">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.42"/>
      <stop offset="55%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.10"/>
    </radialGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
  </defs>`;

// Faithful tank: barrel (drawn first, base tucked under hull), shaded hull.
export function tank(
  cx,
  cy,
  r,
  fill,
  { angle = 0, isBot = false, barrel = fill, shadow = true } = {}
) {
  const baseW = r * 0.62,
    tipW = r * 0.54,
    len = r * 1.55;
  const pts = `0,${-baseW / 2} ${len},${-tipW / 2} ${len},${tipW / 2} 0,${baseW / 2}`;
  return `
  ${shadow ? `<ellipse cx="${cx}" cy="${cy + r * 1.05}" rx="${r * 1.0}" ry="${r * 0.34}" fill="${INK}" opacity="0.20" filter="url(#soft)"/>` : ""}
  <g transform="translate(${cx},${cy})">
    <g transform="rotate(${angle})">
      <polygon points="${pts}" fill="${barrel}" stroke="${INK}"
               stroke-width="${r * 0.2}" stroke-linejoin="round"/>
    </g>
    <circle r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${r * 0.22}"/>
    <circle r="${r}" fill="url(#hi)"/>
    ${isBot ? `<circle r="${r * 0.26}" fill="${INK}"/>` : ""}
  </g>`;
}

// flying cannon ball with motion trail toward `from`
export function shot(cx, cy, r, fill, trail = null) {
  const t = trail
    ? `<line x1="${trail.x}" y1="${trail.y}" x2="${cx}" y2="${cy}" stroke="${fill}" stroke-width="${r * 1.3}" stroke-linecap="round" opacity="0.35"/>`
    : "";
  return `${t}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${r * 0.5}"/>`;
}

// arcade explosion starburst; `scale` 0..1 animates grow + fade
export function boom(cx, cy, R, scale = 1) {
  const rr = R * (0.6 + 0.4 * scale);
  const spikes = 12;
  let pts = "";
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? rr : rr * 0.52;
    const a = (Math.PI * i) / spikes - Math.PI / 2 + scale * 0.4;
    pts += `${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad} `;
  }
  const op = 1 - Math.max(0, scale - 0.6) / 0.4; // fade out in last 40%
  return `<g opacity="${op.toFixed(2)}">
    <polygon points="${pts.trim()}" fill="${P.orange}" stroke="${INK}" stroke-width="${rr * 0.06}" stroke-linejoin="round"/>
    <circle cx="${cx}" cy="${cy}" r="${rr * 0.5}" fill="${P.yellow}"/>
    <circle cx="${cx}" cy="${cy}" r="${rr * 0.22}" fill="${P.white}"/></g>`;
}

export function block(x, y, s, fill = "#9aa0a8") {
  return `
    <ellipse cx="${x + s / 2}" cy="${y + s * 1.02}" rx="${s * 0.52}" ry="${s * 0.16}" fill="${INK}" opacity="0.18" filter="url(#soft)"/>
    <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.16}"
          fill="${fill}" stroke="${INK}" stroke-width="${s * 0.09}"/>
    <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.16}" fill="url(#hi)"/>`;
}

export function field(w, h, cell = 56) {
  let lines = "";
  for (let x = cell; x < w; x += cell)
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`;
  for (let y = cell; y < h; y += cell)
    lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;
  return `<rect width="${w}" height="${h}" fill="${P.field}"/>
    <g stroke="${P.fieldLine}" stroke-width="2">${lines}</g>`;
}

export function doc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${DEFS}${body}</svg>`;
}
