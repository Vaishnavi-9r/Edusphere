const { defineConfig, devices } = require("@playwright/test");
require("dotenv").config({ quiet: true });

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
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
