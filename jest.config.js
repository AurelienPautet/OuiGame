module.exports = {
  testEnvironment: "node",
  // Only the backend has tests for now.
  roots: ["<rootDir>/apps/api"],
  testMatch: ["**/__tests__/**/*.test.{js,ts}"],
  // Transpile-only (no type-check — `tsc --noEmit` is the type gate). CommonJS
  // output so the require()-based helpers + the CJS @ouigame/db interop keep
  // working under jest's CJS runtime. Matches .ts and (transitional) .js.
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: { parser: { syntax: "typescript" }, target: "es2022" },
        module: { type: "commonjs" },
      },
    ],
  },
  globalSetup: "<rootDir>/jest.globalSetup.js",
  setupFiles: ["<rootDir>/jest.setup.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.afterEnv.js"],
  // All test files share a single test database, so run them serially to avoid
  // one file truncating tables while another is mid-test.
  maxWorkers: 1,
  clearMocks: true,
  // Coverage settings are inert unless `--coverage` is passed (`pnpm test:coverage`),
  // so the default `pnpm test` run is unchanged. Reporting-only — no thresholds yet.
  collectCoverageFrom: [
    "apps/api/**/*.{ts,js}",
    "!apps/api/**/__tests__/**",
    "!apps/api/**/*.d.ts",
    "!apps/api/scripts/**",
  ],
  coverageDirectory: "coverage/api",
  coverageReporters: ["text", "lcov"],
};
