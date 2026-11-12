import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: [".env.local", ".env"], quiet: true });

function installedChromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  if (process.platform !== "win32" || !process.env.LOCALAPPDATA) return undefined;
  const root = path.join(process.env.LOCALAPPDATA, "ms-playwright");
  if (!existsSync(root)) return undefined;
  const candidates = readdirSync(root)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .reverse();
  for (const candidate of candidates) {
    const executable = path.join(root, candidate, "chrome-win64", "chrome.exe");
    if (existsSync(executable)) return executable;
  }
  return undefined;
}

const baseURL = "http://127.0.0.1:3005";
const executablePath = installedChromiumPath();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command: "npm run start -- -p 3005",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      NEXTAUTH_SECRET: "phase9-e2e-nextauth-secret-not-for-production",
      NEXTAUTH_URL: baseURL,
      CRON_SECRET: "phase9-e2e-cron-secret-not-for-production",
    },
  },
});
