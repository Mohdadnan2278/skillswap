import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const origin = process.env.SITE_URL ?? "http://127.0.0.1:3000";
const parsed = new URL(origin);
if (!["127.0.0.1", "localhost"].includes(parsed.hostname)) throw new Error("Phase 3 tests create accounts only on a local app.");
export default defineConfig({
  testDir: "./tests/integration",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: origin, trace: "off", screenshot: "off", browserName: "chromium",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
      env: { ...process.env, XDG_CACHE_HOME: "/tmp/skillswap-browser-cache", XDG_CONFIG_HOME: "/tmp/skillswap-browser-config" },
    },
  },
  webServer: { command: `npm run dev -- --hostname 127.0.0.1 --port ${parsed.port || "3000"}`, url: `${origin}/login`, reuseExistingServer: false, timeout: 60_000 },
});
