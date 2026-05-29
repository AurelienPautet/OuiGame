module.exports = {
  testEnvironment: "node",
  // Only the backend has tests for now.
  roots: ["<rootDir>/apps/api"],
  testMatch: ["**/__tests__/**/*.test.js"],
  globalSetup: "<rootDir>/jest.globalSetup.js",
  setupFiles: ["<rootDir>/jest.setup.js"],
  setupFilesAfterEnv: ["<rootDir>/jest.afterEnv.js"],
  // All test files share a single test database, so run them serially to avoid
  // one file truncating tables while another is mid-test.
  maxWorkers: 1,
  clearMocks: true,
};
