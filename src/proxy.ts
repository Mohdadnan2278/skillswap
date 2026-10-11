import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, getSiteOrigin } from "@/backend/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const settings = getSupabaseConfig();
  if (!settings) return response;
  const client = createServerClient(settings.url, settings.key, {
    cookieOptions: { sameSite: "lax", secure: getSiteOrigin()?.startsWith("https:") ?? false },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        // Preserve earlier cookies/cache headers when the SDK sets multiple batches.
        const previous = response;
        response = NextResponse.next({ request });
        previous.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
        for (const name of ["cache-control", "expires", "pragma"]) {
          const value = previous.headers.get(name);
          if (value) response.headers.set(name, value);
        }
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  try { await client.auth.getClaims(); }
  catch { /* Page and API guards perform authoritative identity checks and surface failures. */ }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/admin/:path*", "/community/:path*", "/notifications/:path*", "/reset-password", "/wallet/:path*", "/bookings/:path*", "/discover/:path*", "/people/:path*", "/dashboard/:path*", "/profile/:path*", "/onboarding/:path*", "/login", "/signup", "/api/:path*"] };
