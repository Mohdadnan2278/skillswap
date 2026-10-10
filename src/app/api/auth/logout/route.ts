import { apiHandler, requireConfiguration, requireSameOrigin, parseJson, success, HttpError } from "@/backend/http";
import { createSupabaseServerClient } from "@/backend/supabase/server";
import { emptySchema } from "@/shared/validation";

export async function POST(request: Request) {
  return apiHandler(async () => {
    requireConfiguration(); requireSameOrigin(request); await parseJson(request, emptySchema);
    const client = await createSupabaseServerClient(true);
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error && error.status !== 401 && error.status !== 403)
      throw new HttpError(502, "PROVIDER_UNAVAILABLE", "Could not sign out. Please try again.");
    return success({ redirectTo: "/login" });
  });
}
