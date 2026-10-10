import { apiHandler, requireConfiguration, success } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
export async function GET() {
  return apiHandler(async () => {
    requireConfiguration(); const { client, user } = await verifiedSession(true);
    return success(await getCurrentUser(client, user));
  });
}
