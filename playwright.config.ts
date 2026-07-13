import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/browser",
  workers: 1,
  timeout: 360_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: "http://127.0.0.1:5187",
    headless: true,
    launchOptions: {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
  },
  webServer: {
    command: "npm run dev:all",
    url: "http://127.0.0.1:5187/",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      VELLUM_DEV_API_PORT: "3017",
      VELLUM_DEV_WEB_PORT: "5187",
      VELLUM_FRONTEND_ORIGIN: "http://127.0.0.1:5187",
      VELLUM_WORKSPACES_DIR: "/tmp/vellum-playwright-workspaces",
      VELLUM_EVALUATIONS_DIR: "/tmp/vellum-playwright-evaluations",
    },
  },
});
