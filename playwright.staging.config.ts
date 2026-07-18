import { defineConfig, devices } from "@playwright/test";

const baseURL = "https://dobutabu-staging-v501-pdf.up.railway.app";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 30_000
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    serviceWorkers: "block"
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } }
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
      name: "iphone",
      use: { ...devices["iPhone 13"] }
    },
    {
      name: "android",
      use: { ...devices["Pixel 5"] }
    }
  ]
});
