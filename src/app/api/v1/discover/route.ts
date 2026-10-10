import { apiHandler, requireConfiguration, success } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { discover, queryFields } from "@/backend/skills/service";
import { discoveryQuerySchema } from "@/shared/validation";
export async function GET(request: Request) {
  return apiHandler(async () => {
    requireConfiguration();
    const { client, user } = await verifiedSession();
    return success(await discover(client, user.id, discoveryQuerySchema.parse(queryFields(new URL(request.url)))));
  });
}
