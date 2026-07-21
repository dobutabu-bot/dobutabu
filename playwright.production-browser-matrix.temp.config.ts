import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "production-browser-matrix.temp.spec.ts",
  globalSetup: "./tests/e2e/production-browser-matrix.temp.setup.ts",
  globalTeardown: "./tests/e2e/production-browser-matrix.temp.teardown.ts",
  timeout: 900_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "artifacts/production-browser-matrix/test-results",
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/production-browser-matrix/playwright-results.json" }]
  ],
  use: {
    baseURL: "https://dobutabu-production.up.railway.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
    ignoreHTTPSErrors: false,
    acceptDownloads: true
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 1000 } } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 1000 } } },
    { name: "iphone", use: { ...devices["iPhone 13"] } },
    { name: "android", use: { ...devices["Pixel 5"] } }
  ]
});
