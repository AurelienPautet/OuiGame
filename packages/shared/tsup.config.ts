import { defineConfig } from "tsup";

// Builds two runtime entries into dual ESM + CJS:
//  - game (src/game): the isomorphic game simulation, so the ESM web app can
//    `import { Room, loadlevel } from "@ouigame/shared/game"` and the CommonJS
//    api can `require("@ouigame/shared/game")`.
//  - api (src/api): the Zod request/response schemas. The web consumes these
//    from source (Vite, type-only import) but the CommonJS api needs runtime
//    Zod validators, so it `require("@ouigame/shared/api")` -> dist/api.cjs.
// The ./types + ./socket subpaths stay source-exported (type-only, no build).
// platform "neutral": the game is TypeScript with no node builtins, and zod is
// externalized (a dep), so nothing platform-specific is bundled. dts is ON so
// the typed game runtime ships its own declarations (dist/game.d.ts) — consumers
// resolve "@ouigame/shared/game" to those via the package "types" condition. (The
// api's types are still consumed from source by the web; its emitted api.d.ts is
// harmless and unused.)
//
// clean is gated on !watch: a one-shot `tsup` build cleans dist for a fresh
// output, but `tsup --watch` (the `dev` task) must NOT wipe dist on startup.
// Under `turbo run dev`, `^build` first populates dist/game.js, then the watch
// and `api#dev` start concurrently; a clean here would delete that file in the
// window before the watch's first rebuild finishes, crashing api#dev with
// ERR_MODULE_NOT_FOUND. Skipping clean in watch keeps dist present throughout.
export default defineConfig((options) => ({
  entry: { game: "src/game/index.ts", api: "src/api/index.ts" },
  format: ["esm", "cjs"],
  outDir: "dist",
  target: "es2022",
  platform: "neutral",
  splitting: false,
  sourcemap: true,
  clean: !options.watch,
  // The game runtime is now TypeScript, so ship its declarations: consumers
  // (apps/api, apps/web) resolve "@ouigame/shared/game" to dist/game.d.ts via
  // the package "types" export condition instead of the old ambient shims.
  dts: true,
}));
