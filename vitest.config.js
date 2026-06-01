import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Single root Vitest config using Vitest's `test.projects` (replaces the old
// vitest.workspace.ts). Two projects only — `web` (jsdom) and `shared` (node).
// Neither project's root is `apps/api`, so Vitest never walks into the Jest
// harness there: Jest owns apps/api/__tests__, Vitest owns apps/web + shared.
export default defineConfig({
  test: {
    // Coverage is reporting-only for now (no thresholds): `pnpm test:unit:coverage`
    // prints a summary and writes html/lcov under coverage/. Thresholds can be
    // ratcheted up later per-directory once a baseline is established.
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["apps/web/src/**", "packages/shared/src/**"],
      exclude: [
        "**/__tests__/**",
        "**/*.d.ts",
        "**/index.{ts,js}",
        "apps/web/src/main.tsx",
        "apps/web/src/test/**",
        // Canvas drawing + Howler audio: jsdom stubs make assertions meaningless.
        "apps/web/src/engine/Renderer.ts",
        "apps/web/src/engine/SoundManager.ts",
      ],
    },
    projects: [
      {
        plugins: [react()],
        test: {
          name: "web",
          root: "apps/web",
          environment: "jsdom",
          globals: true,
          include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
        },
      },
      {
        test: {
          name: "shared",
          root: "packages/shared",
          environment: "node",
          globals: true,
          include: ["src/game/__tests__/**/*.{test,spec}.ts"],
        },
      },
    ],
  },
});
