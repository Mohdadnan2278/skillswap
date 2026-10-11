import "server-only";

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || url.includes("your-project") || key === "your-publishable-key") return null;
  try {
    const parsed = new URL(url);
    const local = ["127.0.0.1", "localhost"].includes(parsed.hostname);
    if (parsed.username || parsed.password || (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:"))) return null;
    if (key.startsWith("sb_secret_")) return null;
    // Legacy local anon keys are allowed; never accept a service-role JWT as public config.
    if (!key.startsWith("sb_publishable_")) {
      const payload = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString());
      if (payload.role !== "anon") return null;
    }
    return { url: parsed.origin, key };
  } catch { return null; }
}

export function getSiteOrigin() {
  try {
    const url = new URL(process.env.SITE_URL ?? "");
    const local = ["127.0.0.1", "localhost"].includes(url.hostname);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
      (url.protocol !== "https:" && !(local && url.protocol === "http:"))) return null;
    return url.origin;
  } catch { return null; }
}
export function isAuthConfigured() { return Boolean(getSupabaseConfig() && getSiteOrigin()); }
export async function googleAuthEnabled() {
  const config=getSupabaseConfig();if(!config)return false;
  try {
    const response=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.key},cache:'no-store',signal:AbortSignal.timeout(5000),redirect:'error'});
    if(!response.ok)return false;
    const data=await response.json();return data.external?.google===true;
  }catch{return false;}
}
