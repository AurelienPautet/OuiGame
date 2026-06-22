# itch-assets

Marketing assets for the OuiTank [itch.io](https://itch.io) page, plus the
scripts that generate them. Everything is produced from the game's own palette
(`apps/web/src/theme/palette.ts`) and tank silhouette
(`apps/web/src/engine/tankShape.ts`) — no AI image generation.

## Files

| Asset                                | Size      | Use on itch                                   |
| ------------------------------------ | --------- | --------------------------------------------- |
| `cover.png`                          | 630×500   | **Cover image** (the click-through thumbnail) |
| `og-image.png`                       | 1200×630  | Social share image (Discord/Reddit/X)         |
| `logo.png`                           | 1200×360  | Transparent logo for the page description     |
| `background.png`                     | 1920×1080 | Custom page background                        |
| `favicon-256.png` / `favicon-32.png` | 256 / 32  | Favicon                                       |
| `gameplay.gif`                       | 600×400   | **Real** gameplay loop (best for conversion)  |

## Scripts

All scripts need a one-off dependency install (kept out of the pnpm workspace):

```bash
cd itch-assets
npm install sharp gifenc puppeteer   # creates a local, git-ignored node_modules
```

- **`generate.mjs`** — stills (cover, OG, logo, background, favicons). Pure SVG
  → PNG via sharp. `node generate.mjs`
- **`scene.mjs`** — shared SVG primitives (tank, shot, explosion, field) used by
  the generators.
- **`animate.mjs`** — a _simulated_ skirmish GIF (vector mockup). `node animate.mjs`
- **`capture.mjs`** — the **real** gameplay GIF. Drives a headless Chrome through
  the running dev build, starts an in-memory solo "test" match, screencasts the
  live canvas, and encodes a GIF. Requires the dev server:

  ```bash
  pnpm --filter @ouigame/shared build   # ./game subpath is consumed from dist/
  pnpm dev:web                          # serve on http://localhost:5173
  # in another shell:
  cd itch-assets && node capture.mjs
  ```

  It relies on the DEV-only `window.__ouitankStartTest` hook in
  `apps/web/src/contexts/GameContext.tsx` (stripped from production builds), and
  temporarily makes the demo tank immortal so the round doesn't end mid-capture.
  Set `CHROME_BIN` to reuse an existing Chrome instead of Puppeteer's bundled one.
