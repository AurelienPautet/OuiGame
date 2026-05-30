import { defineConfig } from "tsup";

// Builds the runtime game simulation (src/game) into dual ESM + CJS, so the ESM
// web app can `import { Room, loadlevel } from "@ouigame/shared/game"` and the
// CommonJS api can `require("@ouigame/shared/game")`. The type-only + Zod
// subpaths (./types, ./socket, ./api) stay source-exported (no build). The game
// code is isomorphic (runs in the browser AND node) and pure JS — platform
// "neutral", no node builtins. dts is off for now: the game runtime stays
// untyped this phase (the typed contracts live in ./types); typing the classes
// is a later increment.
export default defineConfig({
  entry: { game: "src/game/index.js" },
  format: ["esm", "cjs"],
  outDir: "dist",
  target: "es2022",
  platform: "neutral",
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
});
