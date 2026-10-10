import { defineConfig } from "@playwright/test";
import {existsSync,readFileSync} from "node:fs";
import {parseEnv} from "node:util";
if(!existsSync(".local/local.env"))throw Error("Run node scripts/environment.mjs prepare-tests first. Tests never load active hosted .env.local.");
const testEnv:Record<string,string>={};
for(const [key,value] of Object.entries(parseEnv(readFileSync(".local/local.env","utf8"))))if(value!==undefined)testEnv[key]=value;
if(!["127.0.0.1","localhost"].includes(new URL(testEnv.NEXT_PUBLIC_SUPABASE_URL??"").hostname))throw Error("Test configuration must use local Supabase.");
for(const key of ["SITE_URL","NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","GOOGLE_AUTH_ENABLED","VIDEO_PROVIDER"])process.env[key]=testEnv[key];

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
  webServer: { env:{...testEnv}, command: `npm run dev -- --hostname 127.0.0.1 --port ${parsed.port || "3000"}`, url: `${origin}/login`, reuseExistingServer: false, timeout: 60_000 },
});
