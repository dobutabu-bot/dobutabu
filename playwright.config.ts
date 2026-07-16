import "dotenv/config";

import { existsSync } from "fs";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3006";
const parsedBaseURL = new URL(baseURL);
const serverHostname = parsedBaseURL.hostname;
const serverPort = parsedBaseURL.port || (parsedBaseURL.protocol === "https:" ? "443" : "80");
const hasProductionBuild = existsSync(".next/BUILD_ID");
const useProductionServer =
  process.env.PLAYWRIGHT_USE_PROD_SERVER === "1" ||
  (process.env.PLAYWRIGHT_USE_PROD_SERVER !== "0" && hasProductionBuild);
const serverUrl = `${baseURL.replace(/\/$/, "")}/api/health`;
const testAuthSecret = process.env.AUTH_SECRET ?? process.env.SESSION_SECRET ?? "local-development-secret-change-me-32chars";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 30_000
  },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }]
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    serviceWorkers: "block"
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER
    ? undefined
    : {
        command: useProductionServer
          ? `npm run start -- -H ${serverHostname} -p ${serverPort}`
          : `npm run dev -- -H ${serverHostname} -p ${serverPort}`,
        url: serverUrl,
        env: {
          ...process.env,
          NODE_ENV: useProductionServer ? "production" : "development",
          PLAYWRIGHT_E2E: "1",
          APP_URL: baseURL,
          AUTH_SECRET: testAuthSecret,
          SESSION_SECRET: testAuthSecret
        },
        // A stale Next.js process can serve an older build while the tests read
        // current source expectations. Reuse is opt-in so release runs fail fast
        // instead of producing misleading UI results.
        reuseExistingServer: process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1",
        timeout: 180_000
      },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } }
    },
    {
      name: "chromium-laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } }
    },
    {
      name: "firefox-desktop",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 1000 } }
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 1000 } }
    },
    {
      name: "tablet",
      use: { ...devices["iPad (gen 7)"] }
    },
    {
      name: "iphone",
      use: { ...devices["iPhone 13"] }
    },
    {
      name: "android",
      use: { ...devices["Pixel 5"] }
    }
  ]
});
