import { redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
import { ProfileForm } from "@/frontend/components/profile-form";
export default async function Onboarding() {
  const { client, user } = await requirePageSession();
  const current = await getCurrentUser(client, user);
  if (current.profile) redirect("/dashboard");
  return <section className="mx-auto max-w-xl"><h1 className="text-3xl font-bold">Make yourself at home</h1><p className="mb-7 mt-3 leading-7 text-slate-600">Introduce yourself to the community. You can update these details later.</p><ProfileForm current={current} onboarding /></section>;
}
