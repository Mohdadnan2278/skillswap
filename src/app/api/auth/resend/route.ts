import { apiHandler, requireConfiguration, requireSameOrigin, parseJson, success, HttpError } from "@/backend/http";
import { getSiteOrigin } from "@/backend/config";
import { createSupabaseServerClient } from "@/backend/supabase/server";
import { resendSchema } from "@/shared/validation";
export async function POST(request: Request) {
  return apiHandler(async () => {
    requireConfiguration(); requireSameOrigin(request);
    const { email } = await parseJson(request, resendSchema);
    const client = await createSupabaseServerClient(true);
    const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${getSiteOrigin()}/auth/callback` } });
    if (error?.status === 429) throw new HttpError(429, "RATE_LIMITED", "Please wait before requesting another email.");
    if (error && (error.name === "AuthRetryableFetchError" || (error.status && error.status >= 500)))
      throw new HttpError(502, "PROVIDER_UNAVAILABLE", "Email delivery is temporarily unavailable.");
    // The response is neutral for unknown or already-confirmed accounts.
    return success({ message: "If this account needs confirmation, a new link has been sent. Check your inbox and spam folder." });
  });
}
