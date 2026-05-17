import { defineConfig, devices } from "@playwright/test";

const previewPort = process.env.PLAYWRIGHT_PORT ?? "4173";
const previewOrigin = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: previewOrigin,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run preview -- --port ${previewPort} --strictPort`,
    url: `${previewOrigin}/pokemon/ditto/`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
