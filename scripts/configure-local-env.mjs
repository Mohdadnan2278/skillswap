import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const file = join(root, ".env.local");
const marker = "# Generated local Supabase settings by SkillSwap; no hosted credentials.";
if (existsSync(file) && !readFileSync(file, "utf8").startsWith(marker)) {
  console.log("Existing .env.local was preserved. Configure the required variables there.");
  process.exit(0);
}
const status = spawnSync(process.execPath, [join(root, "scripts/supabase-local.mjs"), "status", "--output", "json"], { cwd: root, encoding: "utf8" });
if (status.status !== 0) { console.error("Local Supabase is unavailable. Run npm run db:start first."); process.exit(1); }
let data;
try { data = JSON.parse(status.stdout); } catch { console.error("Could not read local Supabase status."); process.exit(1); }
const url = new URL(data.API_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("Local setup will not write hosted credentials.");
const key = data.PUBLISHABLE_KEY || data.ANON_KEY;
if (!key) throw new Error("Local Supabase did not provide a public key.");
writeFileSync(file, `${marker}\nNEXT_PUBLIC_SUPABASE_URL=${url.origin}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${key}\nSITE_URL=http://127.0.0.1:3000\nGOOGLE_AUTH_ENABLED=false\n`, { mode: 0o600 });
console.log("Local .env.local configured; credential values were not printed.");
