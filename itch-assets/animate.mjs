// Renders an animated gameplay GIF for OuiTank by running a tiny tank skirmish
// simulation and drawing each frame with the shared SVG scene primitives, then
// encoding with gifenc. Reproduces the in-game look — no screen capture needed.
// Requires sharp + gifenc. Run: node animate.mjs
import sharp from "sharp";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
// (animate.mjs builds a *simulated* skirmish GIF; the real-gameplay GIF is
// produced by capture.mjs against the running dev build.)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { P, tank, shot, boom, field, block, doc } from "./scene.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));
const W = 600,
  H = 450,
  FRAMES = 56,
  DELAY = 70; // ~14fps, ~3.9s loop

// deterministic RNG so the GIF is reproducible
let seed = 0x9e3779b9;
const rng = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

const COLORS = [
  [P.blue, false],
  [P.red, false],
  [P.green, true],
  [P.purple, true],
  [P.orange, false],
  [P.yellow, true],
];
const M = 46; // wall margin
const tanks = COLORS.map(([c, bot], i) => {
  const ang = (i / COLORS.length) * Math.PI * 2;
  return {
    x: W / 2 + Math.cos(ang) * 150,
    y: H / 2 + Math.sin(ang) * 110,
    vx: (rng() - 0.5) * 3.2,
    vy: (rng() - 0.5) * 3.2,
    r: bot ? 26 : 32,
    color: c,
    bot,
    aim: ang,
    cd: Math.floor(rng() * 30),
  };
});
const blocks = [
  [80, 70, 64],
  [440, 300, 78],
  [300, 110, 54],
];
let bullets = [],
  booms = [];

function step() {
  for (const t of tanks) {
    t.x += t.vx;
    t.y += t.vy;
    if (t.x < M || t.x > W - M) {
      t.vx *= -1;
      t.x = Math.max(M, Math.min(W - M, t.x));
    }
    if (t.y < M || t.y > H - M) {
      t.vy *= -1;
      t.y = Math.max(M, Math.min(H - M, t.y));
    }
    // aim at nearest other tank
    let best = Infinity,
      tx = 0,
      ty = 0;
    for (const o of tanks) {
      if (o === t) continue;
      const d = (o.x - t.x) ** 2 + (o.y - t.y) ** 2;
      if (d < best) {
        best = d;
        tx = o.x;
        ty = o.y;
      }
    }
    const target = Math.atan2(ty - t.y, tx - t.x);
    let da = target - t.aim;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    t.aim += da * 0.18;
    // fire
    if (--t.cd <= 0 && Math.abs(da) < 0.5) {
      t.cd = 22 + Math.floor(rng() * 16);
      const sp = 9,
        bx = t.x + Math.cos(t.aim) * t.r * 1.5,
        by = t.y + Math.sin(t.aim) * t.r * 1.5;
      bullets.push({
        x: bx,
        y: by,
        px: bx,
        py: by,
        vx: Math.cos(t.aim) * sp,
        vy: Math.sin(t.aim) * sp,
        color: t.color,
        life: 42,
      });
    }
  }
  bullets.forEach((b) => {
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
  });
  // collisions / expiry
  const keep = [];
  for (const b of bullets) {
    let dead = b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H;
    for (const t of tanks) {
      if ((t.x - b.x) ** 2 + (t.y - b.y) ** 2 < (t.r + 11) ** 2) {
        dead = true;
        break;
      }
    }
    if (dead) booms.push({ x: b.x, y: b.y, age: 0 });
    else keep.push(b);
  }
  bullets = keep;
  booms.forEach((e) => e.age++);
  booms = booms.filter((e) => e.age < 8);
}

function frameSVG() {
  let s = field(W, H, 56);
  for (const [x, y, sz] of blocks) s += block(x, y, sz);
  for (const b of bullets)
    s += shot(b.x, b.y, 11, b.color, { x: b.px, y: b.py });
  // sort tanks by y for pseudo-depth
  for (const t of [...tanks].sort((a, c) => a.y - c.y))
    s += tank(t.x, t.y, t.r, t.color, {
      angle: (t.aim * 180) / Math.PI,
      isBot: t.bot,
    });
  for (const e of booms) s += boom(e.x, e.y, 48, e.age / 8);
  return doc(W, H, s);
}

const raw = [];
for (let i = 0; i < FRAMES; i++) {
  step();
  const { data } = await sharp(Buffer.from(frameSVG()))
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  raw.push(data);
}

// one global palette (sample evenly spaced frames) → no inter-frame flicker
const sample = Buffer.concat([raw[10], raw[25], raw[40], raw[FRAMES - 1]]);
const palette = quantize(sample, 256);

const gif = GIFEncoder();
for (let i = 0; i < raw.length; i++) {
  const index = applyPalette(raw[i], palette);
  gif.writeFrame(index, W, H, {
    palette,
    delay: DELAY,
    first: i === 0,
    repeat: 0,
  });
}
gif.finish();
writeFileSync(join(OUT, "gameplay.gif"), Buffer.from(gif.bytes()));
console.log(`✓ gameplay.gif ${W}×${H} ${FRAMES}f`);
