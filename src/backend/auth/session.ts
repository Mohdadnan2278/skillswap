import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/backend/supabase/server";
import { isAuthConfigured } from "@/backend/config";
import { HttpError } from "@/backend/http";

export async function verifiedSession(writable = false) {
  const client = await createSupabaseServerClient(writable);
  // An authoritative Auth lookup validates identity and current account/session state.
  // Never authorize using getSession()'s cookie-supplied user object.
  const { data: { user }, error } = await client.auth.getUser();
  if (error && (error.name === "AuthRetryableFetchError" || (error.status && error.status >= 500)))
    throw new HttpError(502, "PROVIDER_UNAVAILABLE", "Sign-in is temporarily unavailable. Try again shortly.");
  if (!user || error) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");
  if (!user.email_confirmed_at) throw new HttpError(403, "EMAIL_UNVERIFIED", "Confirm your email before continuing.");
  return { client, user };
}

export const requirePageSession = cache(async () => {
  if (!isAuthConfigured()) redirect("/login?notice=setup");
  try { return await verifiedSession(); }
  catch (error) {
    if (error instanceof HttpError && error.code === "EMAIL_UNVERIFIED") redirect("/login?notice=verify");
    if (error instanceof HttpError && error.code === "UNAUTHENTICATED") redirect("/login");
    throw error;
  }
});
