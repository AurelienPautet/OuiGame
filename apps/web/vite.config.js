import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "node:fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  return {
    base: "./",
    plugins: [
      react(),
      tailwindcss(),
      // publicDir is disabled during build (below) to avoid an EISDIR on the
      // public/Shared symlink, so we copy assets into dist ourselves. fs.cpSync
      // is deterministic and lands files at dist/<name>; vite-plugin-static-copy
      // v4 nested them under dist/public/, which broke /ressources/* asset URLs.
      {
        name: "copy-assets-to-dist",
        apply: "build",
        closeBundle() {
          // Sibling shared/ folder (outside the Vite root) -> dist/shared.
          fs.cpSync(
            path.resolve(__dirname, "../../shared"),
            path.resolve(__dirname, "dist/shared"),
            { recursive: true }
          );
          // public/ assets -> dist root, skipping the dev-only Shared symlink.
          const publicDir = path.resolve(__dirname, "public");
          for (const entry of fs.readdirSync(publicDir)) {
            if (entry === "Shared") continue;
            fs.cpSync(
              path.join(publicDir, entry),
              path.resolve(__dirname, "dist", entry),
              { recursive: true }
            );
          }
        },
      },
      {
        name: "serve-shared-dev",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            // Match lowercase /shared/ requests from index.html
            if (req.url.startsWith("/shared/")) {
              const sharedPath = path.resolve(__dirname, "../../shared");
              const filePath = req.url.replace("/shared", "");
              // Rewrite to use Vite's internal FS serving
              req.url = `/@fs${sharedPath}${filePath}`;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@shared": path.resolve(__dirname, "../../shared"),
      },
    },
    server: {
      fs: {
        allow: ["../.."],
      },
    },
    // Disable default publicDir copy during build to prevent EISDIR error on Shared symlink
    // But keep it enabled for dev to serve assets from public/Shared
    publicDir: isBuild ? false : "public",
  };
});
