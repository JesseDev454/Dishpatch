/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/tests/**/*.test.ts"],
  setupFilesAfterEnv: ["<rootDir>/src/tests/setup/jest.setup.ts"],
  globalSetup: "<rootDir>/src/tests/setup/global-setup.ts",
  clearMocks: true,
  maxWorkers: 1,
  testTimeout: 30000
};
