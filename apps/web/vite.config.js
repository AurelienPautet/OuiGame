import { defineConfig, normalizePath } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
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
      viteStaticCopy({
        // Only the public assets, which live inside the Vite root. The sibling
        // `shared/` folder is copied separately below — vite-plugin-static-copy
        // (tinyglobby) won't glob paths outside the root.
        targets: isBuild
          ? [
              {
                src:
                  normalizePath(path.resolve(__dirname, "public")) +
                  "/!(*Shared)",
                dest: ".",
              },
            ]
          : [],
      }),
      // Copy the sibling `shared/` folder into dist/shared on build. It lives
      // outside the Vite root, so glob-based copying is unreliable (it works
      // with the lockfile-pinned plugin but a fresh npm install on CI/Heroku
      // resolves a newer vite-plugin-static-copy that refuses out-of-root
      // globs). Copying directly with fs is robust across versions.
      {
        name: "copy-shared-to-dist",
        apply: "build",
        closeBundle() {
          const src = path.resolve(__dirname, "../../shared");
          const dest = path.resolve(__dirname, "dist/shared");
          fs.cpSync(src, dest, { recursive: true });
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
