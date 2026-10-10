import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSiteOrigin, getSupabaseConfig } from "@/backend/config";
import type { Database } from "@/backend/supabase/database.types";

export async function createSupabaseServerClient(writable = false) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured");
  const store = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookieOptions: { sameSite: "lax", secure: getSiteOrigin()?.startsWith("https:") ?? false },
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        if (writable) {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } else {
          // Server Components cannot set cookies. src/proxy.ts refreshes before rendering.
          try { cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options)); }
          catch { /* Response cookies are written by the proxy. */ }
        }
      },
    },
  });
}
