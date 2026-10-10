import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const local = join(root, ".local");
const source = join(process.env.DOCKER_CONFIG ?? join(homedir(), ".docker"), "config.json");
const dockerConfig = join(local, "docker");
mkdirSync(dockerConfig, { recursive: true });
// Preserve proxy routes for external traffic. Only local service names bypass the egress proxy.
// Read the existing proxy settings without logging values or copying registry credentials.
const original = existsSync(source) ? JSON.parse(readFileSync(source, "utf8")) : {};
const proxies = structuredClone(original.proxies ?? {});
const hosts = ["localhost", "127.0.0.1", ...["db", "kong", "auth", "rest", "inbucket"].map(name => `supabase_${name}_skillswap`)];
for (const settings of Object.values(proxies)) {
  settings.noProxy = [settings.noProxy ?? "", ...hosts].filter(Boolean).join(",");
  // Slim images use BusyBox wget for loopback health checks; it ignores NO_PROXY.
  // These local-only containers need direct internal HTTP; preserve external HTTPS proxying.
  settings.httpProxy = "";
}
writeFileSync(join(dockerConfig, "config.json"), JSON.stringify({ proxies }), { mode: 0o600 });
chmodSync(join(root, "supabase/templates/confirmation.html"), 0o644);
const executable = join(root, "node_modules/.bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
const result = spawnSync(executable, process.argv.slice(2), {
  cwd: root, stdio: "inherit", env: { ...process.env,
    SUPABASE_HOME: join(local, "supabase-cli"),
    SUPABASE_USE_SLIM_IMAGES: "true",
    SUPABASE_INTERNAL_IMAGE_REGISTRY: "ghcr.io",
    DOCKER_CONFIG: dockerConfig,
  },
});
if (result.error) { console.error("Could not start the local Supabase CLI. Run npm ci first."); process.exit(1); }
process.exit(result.status ?? 1);
