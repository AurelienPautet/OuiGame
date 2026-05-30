import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  return {
    base: "./",
    plugins: [
      react(),
      tailwindcss(),
      // publicDir is disabled during build (below) and we copy public/ assets
      // into dist ourselves: fs.cpSync is deterministic and lands files at
      // dist/<name>, whereas vite-plugin-static-copy v4 nested them under
      // dist/public/, which broke /ressources/* asset URLs.
      {
        name: "copy-assets-to-dist",
        apply: "build",
        closeBundle() {
          const publicDir = path.resolve(__dirname, "public");
          for (const entry of fs.readdirSync(publicDir)) {
            fs.cpSync(
              path.join(publicDir, entry),
              path.resolve(__dirname, "dist", entry),
              { recursive: true }
            );
          }
        },
      },
    ],
    // Disabled during build; copy-assets-to-dist (above) lands public/ assets at
    // the dist root instead. Enabled in dev to serve them from public/.
    publicDir: isBuild ? false : "public",
  };
});
