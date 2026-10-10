import { apiHandler, parseJson, requireConfiguration, requireSameOrigin, success } from "@/backend/http";
import { verifiedSession } from "@/backend/auth/session";
import { replaceSelections, requireOnboarded, selections } from "@/backend/skills/service";
import { skillSelectionsSchema } from "@/shared/validation";
export async function GET() {
  return apiHandler(async () => {
    requireConfiguration();
    const { client, user } = await verifiedSession();
    return success(await selections(client, user.id));
  });
}
export async function PUT(request: Request) {
  return apiHandler(async () => {
    requireConfiguration(); requireSameOrigin(request);
    const { client, user } = await verifiedSession(true);
    const fields = await parseJson(request, skillSelectionsSchema);
    await requireOnboarded(client, user.id);
    return success(await replaceSelections(client, fields));
  });
}
