import { apiHandler, requireConfiguration, requireSameOrigin, parseJson, success, HttpError } from "@/backend/http";
import { createSupabaseServerClient } from "@/backend/supabase/server";
import { loginSchema } from "@/shared/validation";

export async function POST(request: Request) {
  return apiHandler(async () => {
    requireConfiguration(); requireSameOrigin(request);
    const fields = await parseJson(request, loginSchema);
    const client = await createSupabaseServerClient(true);
    const { data, error } = await client.auth.signInWithPassword(fields);
    if (error?.status === 429) throw new HttpError(429, "RATE_LIMITED", "Too many attempts. Please wait a moment.");
    if (error?.code === "email_not_confirmed") throw new HttpError(403, "EMAIL_UNVERIFIED", "Confirm your email before signing in.");
    if (error && (error.name === "AuthRetryableFetchError" || (error.status && error.status >= 500))) throw new HttpError(502, "PROVIDER_UNAVAILABLE", "Sign-in is temporarily unavailable.");
    if (error || !data.user) throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    const {data: access, error: accessError} = await client.rpc('account_access');
    if (accessError) throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'Account access is temporarily unavailable.');
    if (access && typeof access === 'object' && !Array.isArray(access) && access.suspended) {
      await client.auth.signOut({scope:'local'});
      throw new HttpError(403, 'FORBIDDEN', 'This account is suspended. Contact your SkillSwap administrator.');
    }
    return success({ redirectTo: "/dashboard" });
  });
}
