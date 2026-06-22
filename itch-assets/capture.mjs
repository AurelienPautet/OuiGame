// Captures a REAL gameplay GIF: drives a headless Chrome through the running dev
// build, starts a solo "test" game (in-memory arena, no DB), screenshots the
// live canvas frame by frame, and encodes a GIF with gifenc.
// Run via run-capture.sh (which boots Vite first).
import puppeteer from "puppeteer";
import sharp from "sharp";
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { writeFileSync } from "node:fs";

const URL = process.env.GAME_URL || "http://localhost:5173/";
const COLS = 23,
  ROWS = 16;
const idx = (r, c) => r * COLS + c;

// Build an in-memory arena: player spawn, a spread of bots (codes 11–16),
// interior cover blocks (avoid column 0 — loadlevel double-reads it).
const grid = new Array(COLS * ROWS).fill(0);
const stamp = ([r, c, t]) => (grid[idx(r, c)] = t);
[
  [8, 11, 3], // player spawn (centre)
  // eight bots ringing the arena for sustained, busy combat all clip long
  [2, 7, 11],
  [2, 15, 12],
  [5, 4, 13],
  [5, 18, 14],
  [11, 4, 11],
  [11, 18, 12],
  [14, 7, 13],
  [14, 15, 14],
  // scattered cover blocks (mix of solid + destructible)
  [5, 8, 1],
  [5, 14, 1],
  [11, 8, 1],
  [11, 14, 1],
  [4, 11, 2],
  [12, 11, 2],
  [8, 8, 2],
  [8, 14, 2],
].forEach(stamp);

const VW = 960,
  VH = 640; // viewport (good arena framing)
const GW = 600,
  GH = 400; // GIF size (downscaled from viewport)
const CAPTURE_MS = 5000; // gameplay seconds to screencast
const TARGET_FPS = 15; // downsample target for the GIF

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.CHROME_BIN,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  defaultViewport: { width: VW, height: VH },
});
const page = await browser.newPage();
page.on("console", (m) => {
  const t = m.text();
  if (/error|fail/i.test(t)) console.log("  [page]", t);
});

console.log("→ loading", URL);
await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });

// seed local prefs so solo uses the smart v2 bots and a clean name
await page.evaluate(() => {
  try {
    localStorage.setItem("player_name", "OuiTank");
    localStorage.setItem("bot_system", "v2");
  } catch {}
});

// wait for the dev hook, then start the test game
await page.waitForFunction(
  () => typeof window.__ouitankStartTest === "function",
  { timeout: 30000 }
);
console.log("→ starting solo test game");
await page.evaluate((g) => window.__ouitankStartTest(g), grid);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const engState = () =>
  page.evaluate(() => {
    const e = window.__ouitankEngine;
    return e
      ? {
          running: !!e.running,
          over: !!e.gameOverTriggered,
          countdown: !!e.inCountdown,
        }
      : null;
  });

// wait for the spawn countdown to finish (gameplay frozen until then)
for (let t = 0; t < 80; t++) {
  const s = await engState();
  if (s && s.running && !s.countdown) break;
  await sleep(100);
}
console.log("→ countdown done, fighting");

// Inject a 60fps in-page controller: drive window.gameInput directly (movement
// vector, aim point, fire) so the tank kites smoothly at the engine's tick rate
// instead of being starved by the screenshot cadence. Aims at the nearest bot
// and strafes perpendicular to it (circle-kiting) to survive.
await page.evaluate(() => {
  // Demo immortality: neutralise the solo win/lose check so the round never ends
  // mid-capture, and keep the player tank alive each frame. This is a throwaway
  // capture hack — nothing here is committed or shipped.
  const e0 = window.__ouitankEngine;
  if (e0 && !e0.__capPatched) {
    e0.__capPatched = true;
    e0._checkSoloGameOver = () => {};
  }
  const tick = () => {
    const gi = window.gameInput,
      e = window.__ouitankEngine;
    const room = e && e.localRoom;
    if (gi && room) {
      const ps = Object.values(room.players || {});
      const me = ps.find((p) => !p.is_bot);
      if (me) {
        me.alive = true; // stay alive for the demo
        let best = Infinity,
          tx = me.position.x + 1,
          ty = me.position.y;
        for (const p of ps) {
          if (p.is_bot && p.alive) {
            const d =
              (p.position.x - me.position.x) ** 2 +
              (p.position.y - me.position.y) ** 2;
            if (d < best) {
              best = d;
              tx = p.position.x;
              ty = p.position.y;
            }
          }
        }
        const aim = Math.atan2(ty - me.position.y, tx - me.position.x);
        const sp = gi.mvtSpeed || 5;
        // Hold a stable orbit (radius R) around the arena centre: tangential
        // motion + a radial correction back toward R. Keeps the tank circling in
        // view and away from the walls instead of jittering or beaching itself.
        const Cx = 1150,
          Cy = 800,
          R = 430;
        const vx = me.position.x - Cx,
          vy = me.position.y - Cy,
          L = Math.hypot(vx, vy) || 1;
        const rx = vx / L,
          ry = vy / L; // radial unit
        const tgx = -ry,
          tgy = rx; // tangent (CCW)
        const corr = Math.max(-1, Math.min(1, (R - L) / 220));
        let dx = tgx + rx * corr,
          dy = tgy + ry * corr;
        const dl = Math.hypot(dx, dy) || 1;
        gi.direction.x = (dx / dl) * sp;
        gi.direction.y = (dy / dl) * sp;
        const cv = gi.canvas;
        if (cv)
          gi.aim = {
            x: cv.width / 2 + Math.cos(aim) * 200,
            y: cv.height / 2 + Math.sin(aim) * 200,
          };
        gi.click = true; // rapid fire
      }
    }
    window.__ouiCtl = requestAnimationFrame(tick);
  };
  tick();
});

// Capture via CDP screencast: streams JPEG frames at the page's real render rate
// (cheap, unlike per-frame screenshots), so motion stays smooth. We then
// downsample to ~15fps and use the real frame timestamps as GIF delays.
console.log(`→ screencasting ${CAPTURE_MS}ms of gameplay`);
const client = await page.target().createCDPSession();
const shots = [];
client.on("Page.screencastFrame", async (f) => {
  shots.push({ buf: Buffer.from(f.data, "base64"), t: f.metadata.timestamp });
  try {
    await client.send("Page.screencastFrameAck", { sessionId: f.sessionId });
  } catch {}
});
await client.send("Page.startScreencast", {
  format: "jpeg",
  quality: 85,
  everyNthFrame: 1,
});
await sleep(CAPTURE_MS);
await client.send("Page.stopScreencast").catch(() => {});
await page
  .evaluate(() => cancelAnimationFrame(window.__ouiCtl))
  .catch(() => {});
await browser.close();

shots.sort((a, b) => a.t - b.t);
if (shots.length < 8) {
  console.error("✗ too few screencast frames:", shots.length);
  process.exit(1);
}
// downsample to the target frame rate
const kept = [];
let last = -Infinity;
for (const s of shots) {
  if (s.t - last >= 1 / TARGET_FPS) {
    kept.push(s);
    last = s.t;
  }
}
console.log(
  `  ${shots.length} raw frames → ${kept.length} at ~${TARGET_FPS}fps`
);
const raw = [];
for (const s of kept)
  raw.push(await sharp(s.buf).resize(GW, GH).raw().ensureAlpha().toBuffer());
const delays = kept.map((s, i) =>
  Math.max(
    40,
    Math.min(140, Math.round(((kept[i + 1]?.t ?? s.t + 0.07) - s.t) * 1000))
  )
);

console.log("→ encoding GIF");
const n = raw.length;
const pick = [0, (n * 0.33) | 0, (n * 0.66) | 0, n - 1].map((j) => raw[j]);
const palette = quantize(Buffer.concat(pick), 256);
const gif = GIFEncoder();
for (let i = 0; i < raw.length; i++) {
  gif.writeFrame(applyPalette(raw[i], palette), GW, GH, {
    palette,
    delay: delays[i],
    first: i === 0,
    repeat: 0,
  });
}
gif.finish();
writeFileSync(
  new global.URL("./gameplay.gif", import.meta.url),
  Buffer.from(gif.bytes())
);
console.log(`✓ gameplay.gif ${GW}×${GH} ${raw.length}f`);
