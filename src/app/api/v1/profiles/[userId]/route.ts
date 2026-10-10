import { apiHandler, requireConfiguration, success, HttpError } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { publicProfile } from "@/backend/profiles/service";
import { userIdSchema } from "@/shared/validation";
export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  return apiHandler(async () => {
    requireConfiguration(); const { client } = await verifiedSession(true);
    const id = userIdSchema.parse((await context.params).userId);
    const { data, error } = await client.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw new HttpError(503, "DATABASE_UNAVAILABLE", "Profile storage is temporarily unavailable.");
    if (!data) throw new HttpError(404, "NOT_FOUND", "Profile not found.");
    return success(publicProfile(data));
  });
}
