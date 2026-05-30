import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        // Google Identity Services, injected via an external <script> tag.
        google: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      // PascalCase / underscore-prefixed names (components used only in JSX,
      // intentionally-ignored args like _player) are treated as "used".
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^[A-Z_]" },
      ],
      // The following are flagged across pre-existing code by the aggressive
      // eslint-plugin-react-hooks@7 rules and the Fast-Refresh DX rule. They
      // need dedicated refactors (and ideally tests) rather than mechanical
      // edits, so keep them visible as warnings instead of failing CI.
      "react-refresh/only-export-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/rules-of-hooks": "warn",
    },
  },

  // TypeScript / TSX source (none yet in Phase 0b). Non-type-aware: no
  // parserOptions.project, so it stays fast and pulls no JS into a tsconfig.
  // React hooks/refresh rules are reused; JSX globals match the JS block.
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        google: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^[A-Z_]" },
      ],
      // Phase 5 ratchet: `any` is now an error. The engine's game-runtime
      // boundary is typed via minimal interfaces + the @ouigame/shared/game
      // ambient (RenderBullet/RenderMine) and the shared socket payload types,
      // so no `any` remains in web source.
      "@typescript-eslint/no-explicit-any": "error",
      "react-refresh/only-export-components": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/rules-of-hooks": "warn",
    },
  },

  // Test files: `any` is fine for mocks / fixtures (they run via Vitest, not the
  // strict type gate).
  {
    files: ["**/__tests__/**/*.{ts,tsx}", "**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
