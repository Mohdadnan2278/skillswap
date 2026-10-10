import { apiHandler, requireConfiguration, success } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { catalogue, queryFields } from "@/backend/skills/service";
import { catalogueQuerySchema } from "@/shared/validation";
export async function GET(request: Request) {
  return apiHandler(async () => {
    requireConfiguration();
    const { client } = await verifiedSession();
    return success(await catalogue(client, catalogueQuerySchema.parse(queryFields(new URL(request.url)))));
  });
}
