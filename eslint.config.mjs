import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

// Root lint config: covers the Node server (`Server/`), the dual-environment
// game logic (`shared/`), and root-level tooling configs. The React client in
// `Client/` ships its own flat config (`Client/eslint.config.js`), so we ignore
// it here and let `cd Client && npm run lint` handle it.
export default defineConfig([
  globalIgnores([
    "node_modules",
    "Client",
    "Public",
    "dist",
    "**/migrations/**",
  ]),

  // Express server: Node runtime, CommonJS modules.
  {
    files: ["Server/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // Shared game logic runs in BOTH the Node server and the browser client and
  // exports via `module.exports`, so it needs Node + browser globals.
  {
    files: ["shared/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // These files are loaded as plain <script> tags in the browser client,
      // so sibling classes (Block, Hole, ...) and shared mutable state resolve
      // as ambient globals at runtime. no-undef can't see that and only adds
      // noise here, so we disable it for shared/ (it stays on for Server/).
      "no-undef": "off",
    },
  },

  // Root tooling configs (eslint.config.js, drizzle.config.js) are ES modules.
  {
    files: ["*.config.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
]);
