import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/backend/supabase/server";
import { getSiteOrigin, isAuthConfigured } from "@/backend/config";
import { safeReturnPath } from "@/shared/validation";
export async function GET(request: Request) {
  const origin = getSiteOrigin();
  if (!origin || !isAuthConfigured()) return NextResponse.redirect(new URL("/login?notice=setup", request.url));
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let valid = false;
  if (code) {
    try {
      const client = await createSupabaseServerClient(true);
      const { error } = await client.auth.exchangeCodeForSession(code);
      valid = !error;
    } catch { /* Display a generic callback failure; never echo tokens/provider errors. */ }
  }
  const destination = valid ? safeReturnPath(url.searchParams.get("next")) : "/login?notice=callback";
  return NextResponse.redirect(new URL(destination, origin), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
