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
  blue: "#00b2e1", blueD: "#0085a8",
  red: "#f14e54", redD: "#b8383d",
  green: "#00e06a", greenD: "#00a64e",
  yellow: "#ffe869", yellowD: "#c9b53f",
  purple: "#bf7ff5", purpleD: "#9355c9",
  orange: "#ffb142", orangeD: "#c98821",
  teal: "#2dd4bf", tealD: "#1c9c8d",
  ink: "#2b2f36", inkSoft: "#555b66",
  field: "#c9cdd2", fieldLine: "#b8bdc4", panelDark: "#1f232a", white: "#fff",
};
const INK = P.ink;

// --- tank: faithful port of drawTank (barrel first, then hull) ----------------
function tank(cx, cy, r, fill, { angle = 0, isBot = false, barrel = fill } = {}) {
  const baseW = r * 0.62, tipW = r * 0.54, len = r * 1.55;
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

// arcade explosion: layered starburst
function boom(cx, cy, R) {
  const spikes = 12;
  let pts = "";
  for (let i = 0; i < spikes * 2; i++) {
    const rad = (i % 2 === 0 ? R : R * 0.52);
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts += `${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad} `;
  }
  return `
    <polygon points="${pts.trim()}" fill="${P.orange}" stroke="${INK}" stroke-width="${R * 0.06}" stroke-linejoin="round"/>
    <circle cx="${cx}" cy="${cy}" r="${R * 0.5}" fill="${P.yellow}"/>
    <circle cx="${cx}" cy="${cy}" r="${R * 0.22}" fill="${P.white}"/>`;
}

// rounded obstacle block
function block(x, y, s, fill = "#9aa0a8") {
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.16}"
           fill="${fill}" stroke="${INK}" stroke-width="${s * 0.09}"/>`;
}

// field + grid, clipped to a rounded rect of given size
function field(w, h, cell = 56) {
  let lines = "";
  for (let x = cell; x < w; x += cell) lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`;
  for (let y = cell; y < h; y += cell) lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;
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
  const w = 630, h = 500;
  const scene = `
    ${field(w, h)}
    <!-- obstacles -->
    ${block(70, 70, 70)}
    ${block(480, 330, 84)}
    ${block(300, 60, 60, "#8e959e")}
    <!-- shots in flight -->
    ${shot(250, 250, 13, P.blue)}
    ${shot(300, 235, 11, P.blue)}
    ${shot(395, 300, 12, P.red)}
    ${shot(150, 360, 10, P.green)}
    <!-- bots (dotted) -->
    ${tank(120, 380, 40, P.green, { angle: -35, isBot: true })}
    ${tank(540, 130, 40, P.purple, { angle: 150, isBot: true })}
    ${tank(470, 410, 36, P.yellow, { angle: 200, isBot: true })}
    <!-- player tanks duelling -->
    ${tank(180, 250, 52, P.blue, { angle: -18 })}
    ${tank(450, 290, 50, P.red, { angle: 165 })}
    ${tank(360, 150, 44, P.orange, { angle: 60 })}
    <!-- impact -->
    ${boom(330, 250, 60)}
    <!-- title band -->
    <rect x="0" y="${h - 96}" width="${w}" height="96" fill="${P.ink}" opacity="0.88"/>
    ${wordmark(w / 2, h - 32, 64, { oui: P.white, tank: P.blue })}`;
  await render(scene, w, h, "cover.png");
}

// =============================================================================
// 2. BACKGROUND 1920×1080 — subtle, low-contrast for page legibility
// =============================================================================
{
  const w = 1920, h = 1080;
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
  const w = 1200, h = 360;
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
  const w = 1200, h = 630;
  const scene = `
    ${field(w, h, 60)}
    ${block(120, 110, 90)}
    ${block(960, 410, 100)}
    ${shot(520, 300, 16, P.blue)}
    ${shot(640, 330, 14, P.red)}
    ${tank(250, 360, 70, P.green, { angle: -25, isBot: true })}
    ${tank(940, 230, 64, P.purple, { angle: 150, isBot: true })}
    ${tank(420, 300, 82, P.blue, { angle: -10 })}
    ${tank(760, 350, 80, P.red, { angle: 170 })}
    ${boom(600, 310, 78)}
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
    const scene = `
      <rect width="${r}" height="${r}" rx="${r * 0.22}" fill="${P.field}"/>
      <rect width="${r}" height="${r}" rx="${r * 0.22}" fill="none" stroke="${INK}" stroke-width="${r * 0.06}"/>
      ${tank(r / 2, r / 2, r * 0.3, P.blue, { angle: -30 })}`;
    return render(scene, r, r, file);
  };
  await make(256, "favicon-256.png");
  await make(32, "favicon-32.png");
}

console.log("\nAll assets written to itch-assets/");
