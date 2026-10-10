import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/backend/supabase/server";
import { getSiteOrigin, isAuthConfigured } from "@/backend/config";
export async function GET(request: Request) {
  const origin = getSiteOrigin();
  if (!origin || !isAuthConfigured()) return NextResponse.redirect(new URL("/login?notice=setup", request.url));
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  let valid = false;
  if (tokenHash && (type === "email" || type === "signup")) {
    try {
      const client = await createSupabaseServerClient(true);
      const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
      valid = !error;
    } catch { /* No token or provider details in errors. */ }
  }
  return NextResponse.redirect(new URL(valid ? "/dashboard" : "/login?notice=callback", origin), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
