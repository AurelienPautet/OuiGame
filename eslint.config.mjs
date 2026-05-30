import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// Root lint config: covers the Node server (`apps/api`), the isomorphic game
// runtime (`packages/shared/src/game`), and root-level tooling configs. The
// React client (`apps/web`) ships its own flat config
// (`apps/web/eslint.config.js`), so we ignore it here.
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

  // The isomorphic game runtime (@ouigame/shared/game): ES modules that run in
  // BOTH the Node server and the browser client, so they get Node + browser
  // globals. (Replaces the old root shared/**/*.js block.)
  {
    files: ["packages/shared/src/game/**/*.js"],
    ignores: ["packages/shared/src/game/**/__tests__/**"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // The game's Vitest golden tests: same module + isomorphic globals, plus the
  // Vitest test API (describe/it/expect/vi/...) which is ambient via the shared
  // project's `globals: true`.
  {
    files: ["packages/shared/src/game/**/__tests__/**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
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
