// Generates itch.io page assets for OuiTank by reproducing the in-game tank
// silhouette (apps/web/src/engine/tankShape.ts) in SVG, then rasterising with
// sharp. Pure vector compositing — no AI image generation.
// Requires sharp: `npx --yes -p sharp node generate.mjs` (or install sharp).
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = dirname(fileURLToPath(import.meta.url));

// --- official palette (mirror of apps/web/src/theme/palette.ts) ---------------
const P = {
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
const INK = P.ink;

// --- tank: faithful port of drawTank (barrel first, then hull) ----------------
function tank(
  cx,
  cy,
  r,
  fill,
  { angle = 0, isBot = false, barrel = fill } = {}
) {
  const baseW = r * 0.62,
    tipW = r * 0.54,
    len = r * 1.55;
  const pts = `0,${-baseW / 2} ${len},${-tipW / 2} ${len},${tipW / 2} 0,${baseW / 2}`;
  return `
  <g transform="translate(${cx},${cy})">
    <g transform="rotate(${angle})">
      <polygon points="${pts}" fill="${barrel}" stroke="${INK}"
               stroke-width="${r * 0.2}" stroke-linejoin="round"/>
    </g>
    <circle r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${r * 0.22}"/>
    ${isBot ? `<circle r="${r * 0.26}" fill="${INK}"/>` : ""}
  </g>`;
}

// small flying ball (cannon shot)
function shot(cx, cy, r, fill) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${r * 0.5}"/>`;
}

// --- color helpers (port of palette.mixHex) for the explosion gradient -------
function hexToRgb(h) {
  h = h.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
function mixHex(a, b, t) {
  const ca = hexToRgb(a),
    cb = hexToRgb(b);
  const ch = (x, y) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(ca[0], cb[0])}${ch(ca[1], cb[1])}${ch(ca[2], cb[2])}`;
}
// warm debris gradient sampled at t∈[0,1]: yellow → orange → red → charred ink,
// exactly the warmDebris() steps from ParticleSystem.ts.
function warmAt(t) {
  const stops = [
    [0, P.yellow],
    [0.4, P.orange],
    [0.7, P.red],
    [1, INK],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i],
      [p1, c1] = stops[i + 1];
    if (t <= p1) return mixHex(c0, c1, (t - p0) / (p1 - p0));
  }
  return INK;
}
// deterministic RNG so the same explosion renders every run
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// REAL explosion: a burst cloud of round debris particles (warm yellow→orange→
// red→ink, brighter toward the core) + an expanding white/yellow shockwave ring,
// matching ParticleSystem.explosion() instead of a cartoon starburst.
function boom(cx, cy, R, seed = 7) {
  const rnd = mulberry32(seed);
  let s = "";
  // shockwave ring (Chockwave: white→yellow annulus)
  s += `<circle cx="${cx}" cy="${cy}" r="${R * 0.92}" fill="none"
          stroke="${mixHex(P.white, P.yellow, 0.4)}" stroke-width="${R * 0.1}" opacity="0.85"/>`;
  // debris particles — denser & hotter near the centre
  const N = 50;
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2;
    const dist = Math.pow(rnd(), 0.55) * R; // bias toward centre
    const px = cx + Math.cos(a) * dist;
    const py = cy + Math.sin(a) * dist;
    const pr = 4 + rnd() * 9;
    const t = Math.min(1, dist / R);
    s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${pr.toFixed(1)}" fill="${warmAt(t)}"/>`;
  }
  // a few tiny white-hot sparks flung out past the cloud
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const dist = R * (0.9 + rnd() * 0.35);
    s += `<circle cx="${(cx + Math.cos(a) * dist).toFixed(1)}" cy="${(cy + Math.sin(a) * dist).toFixed(1)}"
            r="${(2 + rnd() * 2).toFixed(1)}" fill="${P.white}"/>`;
  }
  // bright core
  s += `<circle cx="${cx}" cy="${cy}" r="${R * 0.2}" fill="${P.white}"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${R * 0.34}" fill="${P.yellow}" opacity="0.55"/>`;
  return s;
}

// rounded obstacle block
function block(x, y, s, fill = "#9aa0a8") {
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.16}"
           fill="${fill}" stroke="${INK}" stroke-width="${s * 0.09}"/>`;
}

// field + grid, clipped to a rounded rect of given size
function field(w, h, cell = 56) {
  let lines = "";
  for (let x = cell; x < w; x += cell)
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`;
  for (let y = cell; y < h; y += cell)
    lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;
  return `
    <rect width="${w}" height="${h}" fill="${P.field}"/>
    <g stroke="${P.fieldLine}" stroke-width="2">${lines}</g>`;
}

// wordmark "OuiTank" with thick ink outline (paint-order)
function wordmark(cx, y, size, { oui = INK, tank = P.blue } = {}) {
  const common = `font-family="DejaVu Sans" font-weight="bold" font-size="${size}"
    text-anchor="middle" paint-order="stroke" stroke="${INK}"
    stroke-width="${size * 0.14}" stroke-linejoin="round"`;
  // measure-free: draw whole word centered, then a second colored span via two texts
  return `
    <text x="${cx}" y="${y}" ${common} fill="${oui}">Oui<tspan fill="${tank}">Tank</tspan></text>`;
}

async function render(svg, w, h, file) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${svg}</svg>`;
  await sharp(Buffer.from(doc)).png().toFile(join(OUT, file));
  console.log("✓", file, `${w}×${h}`);
}

// =============================================================================
// 1. COVER 630×500  — chaotic multiplayer scene
// =============================================================================
{
  const w = 630,
    h = 500;
  const scene = `
    ${field(w, h)}
    <!-- sparse obstacles, kept clear of the tanks -->
    ${block(40, 50, 60)}
    ${block(530, 60, 64)}
    <!-- two duelling tanks, well spaced, barrels aimed at the impact -->
    ${tank(140, 210, 50, P.blue, { angle: 0 })}
    ${tank(490, 220, 48, P.red, { angle: 180 })}
    <!-- one bot up top, aiming down into the action -->
    ${tank(330, 78, 38, P.purple, { angle: 110, isBot: true })}
    <!-- shots converging on the impact -->
    ${shot(232, 209, 12, P.blue)}
    ${shot(400, 216, 11, P.red)}
    <!-- real particle-cloud explosion between them -->
    ${boom(315, 208, 58, 11)}
    <!-- title band -->
    <rect x="0" y="${h - 96}" width="${w}" height="96" fill="${P.ink}" opacity="0.88"/>
    ${wordmark(w / 2, h - 32, 64, { oui: P.white, tank: P.blue })}`;
  await render(scene, w, h, "cover.png");
}

// =============================================================================
// 2. BACKGROUND 1920×1080 — subtle, low-contrast for page legibility
// =============================================================================
{
  const w = 1920,
    h = 1080;
  const faint = (t) => `<g opacity="0.10">${t}</g>`;
  const scene = `
    ${field(w, h, 64)}
    ${faint(tank(300, 260, 90, P.ink, { angle: 25 }))}
    ${faint(tank(1600, 300, 80, P.ink, { angle: 150 }))}
    ${faint(tank(500, 850, 100, P.ink, { angle: -40 }))}
    ${faint(tank(1500, 820, 85, P.ink, { angle: 200 }))}
    ${faint(tank(960, 540, 120, P.ink, { angle: 10 }))}
    <!-- darkening vignette so foreground UI text stays readable -->
    <radialGradient id="v" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="${P.ink}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${P.panelDark}" stop-opacity="0.55"/>
    </radialGradient>
    <rect width="${w}" height="${h}" fill="url(#v)"/>`;
  await render(scene, w, h, "background.png");
}

// =============================================================================
// 3. LOGO (transparent) — wordmark + a little tank
// =============================================================================
{
  const w = 1200,
    h = 360;
  const scene = `
    ${tank(190, 200, 86, P.blue, { angle: -20 })}
    <text x="640" y="232" font-family="DejaVu Sans" font-weight="bold"
      font-size="150" text-anchor="middle" paint-order="stroke"
      stroke="${INK}" stroke-width="20" stroke-linejoin="round" fill="${P.white}">Oui<tspan fill="${P.blue}">Tank</tspan></text>`;
  await render(scene, w, h, "logo.png");
}

// =============================================================================
// 4. OG SHARE IMAGE 1200×630 — wide hero + tagline
// =============================================================================
{
  const w = 1200,
    h = 630;
  const scene = `
    ${field(w, h, 60)}
    <!-- sparse obstacles -->
    ${block(110, 80, 88)}
    ${block(990, 360, 92)}
    <!-- two duelling tanks, generous spacing -->
    ${tank(300, 250, 72, P.blue, { angle: 0 })}
    ${tank(900, 270, 70, P.red, { angle: 180 })}
    <!-- one bot up top -->
    ${tank(620, 92, 52, P.purple, { angle: 110, isBot: true })}
    <!-- converging shots -->
    ${shot(470, 252, 15, P.blue)}
    ${shot(760, 266, 14, P.red)}
    <!-- real particle-cloud explosion -->
    ${boom(600, 256, 86, 23)}
    <rect x="0" y="${h - 150}" width="${w}" height="150" fill="${P.ink}" opacity="0.9"/>
    <text x="${w / 2}" y="${h - 78}" font-family="DejaVu Sans" font-weight="bold"
      font-size="84" text-anchor="middle" fill="${P.white}">Oui<tspan fill="${P.blue}">Tank</tspan></text>
    <text x="${w / 2}" y="${h - 30}" font-family="DejaVu Sans" font-size="34"
      text-anchor="middle" fill="${P.field}">Multiplayer tank battles — play free in your browser</text>`;
  await render(scene, w, h, "og-image.png");
}

// =============================================================================
// 5. FAVICON / ICON — single tank on a rounded field tile
// =============================================================================
{
  const make = (size, file) => {
    const r = size;
    const sw = r * 0.06; // border stroke; inset by half so it isn't clipped
    const i = sw / 2;
    const scene = `
      <rect x="${i}" y="${i}" width="${r - sw}" height="${r - sw}" rx="${r * 0.2}" fill="${P.field}"/>
      <rect x="${i}" y="${i}" width="${r - sw}" height="${r - sw}" rx="${r * 0.2}"
            fill="none" stroke="${INK}" stroke-width="${sw}"/>
      ${tank(r / 2, r / 2, r * 0.27, P.blue, { angle: -30 })}`;
    return render(scene, r, r, file);
  };
  await make(256, "favicon-256.png");
  await make(32, "favicon-32.png");
}

console.log("\nAll assets written to itch-assets/");
