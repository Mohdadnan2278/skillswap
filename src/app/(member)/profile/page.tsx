import { redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
import { ProfileForm } from "@/frontend/components/profile-form";
export default async function Profile() {
  const { client, user } = await requirePageSession();
  const current = await getCurrentUser(client, user);
  if (!current.profile) redirect("/onboarding");
  return <section className="mx-auto max-w-xl"><h1 className="text-3xl font-bold">Your profile</h1><p className="mb-7 mt-3 leading-7 text-slate-600">Tell the community a little about yourself.</p><ProfileForm current={current} /></section>;
}
