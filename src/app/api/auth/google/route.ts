import { apiHandler, requireConfiguration, requireSameOrigin, parseJson, success, HttpError } from "@/backend/http";
import { googleAuthEnabled, getSiteOrigin } from "@/backend/config";
import { createSupabaseServerClient } from "@/backend/supabase/server";
import { emptySchema } from "@/shared/validation";

export async function POST(request: Request) {
  return apiHandler(async () => {
    requireConfiguration(); requireSameOrigin(request); await parseJson(request, emptySchema);
    if (!await googleAuthEnabled()) throw new HttpError(503, "PROVIDER_UNAVAILABLE", "Google sign-in is being set up. Please try another sign-in method.");
    const client = await createSupabaseServerClient(true);
    const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${getSiteOrigin()}/auth/callback`, skipBrowserRedirect: true } });
    if (error || !data.url) throw new HttpError(502, "PROVIDER_UNAVAILABLE", "Google sign-in is temporarily unavailable.");
    return success({ redirectTo: data.url });
  });
}
