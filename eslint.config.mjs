import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// Root lint config: covers the Node server (`Server/`), the dual-environment
// game logic (`shared/`), and root-level tooling configs. The React client in
// `Client/` ships its own flat config (`Client/eslint.config.js`), so we ignore
// it here and let `cd Client && npm run lint` handle it.
export default defineConfig([
  globalIgnores([
    "node_modules",
    "apps/web",
    "Public",
    "dist",
    "**/migrations/**",
  ]),

  // Express server: Node runtime, CommonJS modules.
  {
    files: ["apps/api/**/*.js"],
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

  // Root tooling configs (eslint.config.mjs, drizzle.config.js) are ES modules.
  {
    files: ["*.config.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // Jest test suite and the CommonJS Jest config files: Node + Jest globals
  // (describe/test/expect/beforeEach/...). Listed last so it layers on top of
  // the Server/** block for files under Server/__tests__/.
  {
    files: [
      "apps/api/__tests__/**/*.js",
      "jest.config.js",
      "jest.setup.js",
      "jest.afterEnv.js",
      "jest.globalSetup.js",
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // TypeScript source (none yet in Phase 0b; this wires future .ts files).
  // Non-type-aware only: no parserOptions.project/projectService, so no JS file
  // is ever forced into a tsconfig and lint stays fast. Scoped to **/*.ts(x) so
  // the all-JS blocks above are untouched.
  {
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
]);
