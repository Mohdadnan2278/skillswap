import { apiHandler, parseJson, requireConfiguration, requireSameOrigin, success } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { catalogue, createCustomSkill, queryFields } from "@/backend/skills/service";
import { customSkillSchema } from "@/shared/skills";
import { catalogueQuerySchema } from "@/shared/validation";
export async function GET(request: Request) {
  return apiHandler(async () => {
    requireConfiguration();
    const { client } = await verifiedSession();
    return success(await catalogue(client, catalogueQuerySchema.parse(queryFields(new URL(request.url)))));
  });
}
export async function POST(request: Request) {
  return apiHandler(async () => {
    requireConfiguration(); requireSameOrigin(request);
    const { client } = await verifiedSession(true);
    const result = await createCustomSkill(client, await parseJson(request, customSkillSchema));
    return success(result, result.created ? 201 : 200);
  });
}
