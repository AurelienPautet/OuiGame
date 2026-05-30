import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Single root Vitest config using Vitest's `test.projects` (replaces the old
// vitest.workspace.ts). Two projects only — `web` (jsdom) and `shared` (node).
// Neither project's root is `apps/api`, so Vitest never walks into the Jest
// harness there: Jest owns apps/api/__tests__, Vitest owns apps/web + shared.
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "web",
          root: "apps/web",
          environment: "jsdom",
          globals: true,
          include: ["src/**/*.{test,spec}.{js,jsx}"],
        },
      },
      {
        test: {
          name: "shared",
          root: "shared",
          environment: "node",
          globals: true,
          include: ["__tests__/**/*.{test,spec}.js"],
        },
      },
    ],
  },
});
