const { defineConfig, devices } = require("@playwright/test");
require("dotenv").config({ quiet: true });

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
const e2eJwtSecret = process.env.E2E_JWT_SECRET;

if (!e2eDatabaseUrl || !e2eJwtSecret) {
  throw new Error("Set E2E_DATABASE_URL and E2E_JWT_SECRET before running E2E tests.");
}

let e2eDatabaseHost;
try {
  e2eDatabaseHost = new URL(e2eDatabaseUrl).hostname;
} catch {
  throw new Error("E2E_DATABASE_URL is not a valid database URL.");
}

if (!e2eDatabaseHost.endsWith(".pooler.supabase.com")) {
  throw new Error("E2E_DATABASE_URL must use the isolated Supabase Session Pooler.");
}

module.exports = defineConfig({
  testDir: "./tests/e2e",
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:5000",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:5000/",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: e2eDatabaseUrl,
      JWT_SECRET: e2eJwtSecret,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
