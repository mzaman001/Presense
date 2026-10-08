import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/global-setup.ts",
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      // Full Chromium in new headless mode, not the default headless shell:
      // the shell has no binder for on-device speech recognition, so the
      // renderer is killed ("bad Mojo message") the moment useSpeechCapture
      // asks SpeechRecognition.available() on / and /do.
      use: { ...devices["Desktop Chrome"], channel: "chromium" },
    },
  ],
  // CI tests the production build it just made. Locally, whatever already
  // runs on :3000 is reused: check which build that is before trusting a run.
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
