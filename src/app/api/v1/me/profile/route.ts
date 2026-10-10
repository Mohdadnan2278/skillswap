import { apiHandler, requireConfiguration, requireSameOrigin, parseJson, success } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { getCurrentUser, saveProfile } from "@/backend/profiles/service";
import { profileSchema } from "@/shared/validation";
export async function PATCH(request: Request) {
  return apiHandler(async () => {
    requireConfiguration(); requireSameOrigin(request);
    const { client, user } = await verifiedSession(true);
    const fields = await parseJson(request, profileSchema);
    await saveProfile(client, fields);
    return success(await getCurrentUser(client, user));
  });
}
