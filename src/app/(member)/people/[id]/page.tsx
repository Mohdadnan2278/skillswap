import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { allSkills, selections } from "@/backend/skills/service";
import { userIdSchema } from "@/shared/validation";
import { HttpError } from "@/backend/http";
export default async function MemberProfile({ params }: { params: Promise<{ id: string }> }) {
  const { client, user } = await requirePageSession();
  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) notFound();
  if (id === user.id) redirect("/profile");
  const { data: profile, error } = await client.from("profiles").select("display_name,bio,college").eq("id", id).maybeSingle();
  if (error) throw new HttpError(503, "DATABASE_UNAVAILABLE", "Profile storage is temporarily unavailable.");
  if (!profile) notFound();
  const [skills, own] = await Promise.all([allSkills(client), selections(client, id)]);
  const offered = skills.filter(skill => own.offeredSkillIds.includes(skill.id));
  return <section className="mx-auto max-w-2xl"><Link className="inline-flex min-h-11 items-center text-emerald-800 underline" href="/discover">Back to discovery</Link><h1 className="mt-5 break-words text-3xl font-bold">{profile.display_name}</h1>{profile.college && <p className="mt-3 break-words text-slate-500">{profile.college}</p>}<p className="mt-5 break-words whitespace-pre-wrap leading-7">{profile.bio || "This member has not added a bio yet."}</p><h2 className="mt-8 text-xl font-semibold">Can teach</h2>{offered.length ? <ul className="mt-4 flex flex-wrap gap-2">{offered.map(skill => <li key={skill.id} className="rounded-full bg-emerald-100 px-4 py-2 text-emerald-900">{skill.name}</li>)}</ul> : <p className="mt-3">No offered skills selected yet.</p>}<p className="mt-6 text-sm text-slate-500">No ratings yet. Booking requests will be available in a later phase.</p></section>;
}
