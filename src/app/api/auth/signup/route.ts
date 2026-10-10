import { apiHandler, requireConfiguration, requireSameOrigin, parseJson, success, HttpError } from "@/backend/http";
import { getSiteOrigin } from "@/backend/config";
import { createSupabaseServerClient } from "@/backend/supabase/server";
import { signupSchema } from "@/shared/validation";

export async function POST(request: Request) {
  return apiHandler(async () => {
    requireConfiguration(); requireSameOrigin(request);
    const fields = await parseJson(request, signupSchema);
    const client = await createSupabaseServerClient(true);
    const { data, error } = await client.auth.signUp({ ...fields, options: { emailRedirectTo: `${getSiteOrigin()}/auth/callback` } });
    if (error?.status === 429) throw new HttpError(429, "RATE_LIMITED", "Please wait before requesting another confirmation email.");
    if (error?.code === "weak_password") throw new HttpError(400, "VALIDATION_ERROR", "Use a stronger password matching the project's password policy.");
    if (error) throw new HttpError(502, "PROVIDER_UNAVAILABLE", "Could not create the account. Please try again shortly.");
    return success({ verificationRequired: !data.session, redirectTo: data.session ? "/onboarding" : null }, 201);
  });
}
