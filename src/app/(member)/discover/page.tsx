import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { selectedSkills, discover, requireOnboarded, selections } from "@/backend/skills/service";
import { discoveryQuerySchema } from "@/shared/validation";
import { HttpError } from "@/backend/http";
import {ReputationLabel} from "@/frontend/components/reputation";
import {LiveRefresh} from '@/frontend/components/live-refresh';
export default async function Discover({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { client, user } = await requirePageSession();
  try { await requireOnboarded(client, user.id); }
  catch (error) { if (error instanceof HttpError && error.code === "PROFILE_INCOMPLETE") redirect("/onboarding"); throw error; }
  const raw = Object.fromEntries(Object.entries(await searchParams).filter(([, value]) => value !== undefined && value !== ""));
  const parsed = discoveryQuerySchema.safeParse(raw);
  const own=await selections(client,user.id);
  const wanted=await selectedSkills(client,own.wantedSkillIds);
  let page;
  let message = "";
  if (!parsed.success) message = "This filter or page link is invalid. Start again below.";
  else {
    try { page = await discover(client, user.id, parsed.data); }
    catch (error) { if (error instanceof HttpError && error.status === 400) message = error.message; else throw error; }
  }
  return <section><LiveRefresh seconds={30}/><h1 className="text-3xl font-bold">Discover members</h1><p className="mt-3 leading-7 text-muted">Find people who can teach the skills you want to learn.</p>
    {wanted.length === 0 ? <div className="mt-8 rounded-2xl bg-surface p-6"><h2 className="text-xl font-semibold">What would you like to learn?</h2><p className="mt-3">Choose wanted skills in your profile to find matches.</p><Link href="/profile" className="secondary-button mt-4 min-h-11 font-semibold text-accent-strong">Choose skills</Link></div> : <form action="/discover" className="my-7 grid items-end gap-3 sm:flex sm:flex-wrap"><div className="min-w-0"><label htmlFor="skill-filter" className="block font-semibold">Wanted skill</label><select id="skill-filter" name="skillId" className="field" defaultValue={parsed.success ? parsed.data.skillId ?? "" : ""}><option value="">All wanted skills</option>{wanted.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></div><label className="flex min-h-11 items-center gap-3"><input type="checkbox" name="availableOnly" value="true" defaultChecked={parsed.success&&parsed.data.availableOnly===true}/>Available now only</label><button className="primary-button">Apply filter</button></form>}
    {message && <p role="status" className="my-6 rounded-xl bg-soft p-4">{message} <Link className="secondary-button" href="/discover">Reset discovery</Link></p>}
    {wanted.length > 0 && page?.items.length === 0 && <p role="status" className="rounded-xl bg-surface p-6">No members offer these skills yet. Try another wanted skill or check back soon.</p>}
    <div className="grid gap-5 sm:grid-cols-2">{page?.items.map(match => <article key={match.profile.id} className="min-w-0 rounded-2xl border border-line bg-surface p-6"><h2 className="break-words text-xl font-semibold">{match.profile.displayName}</h2>{match.profile.college && <p className="mt-2 break-words text-sm text-subtle">{match.profile.college}</p>}<p className="mt-3 break-words whitespace-pre-wrap text-muted">{match.profile.bio || "This member has not added a bio yet."}</p><p className="mt-4 font-semibold text-accent-strong">Can help you learn: {match.matchedSkills.map(skill => skill.name).join(", ")}</p>{match.availableUntil&&<p className="mt-3 font-semibold text-accent-strong">Available to teach now</p>}<ReputationLabel value={match.profile.reputation}/><Link href={`/people/${match.profile.id}`} className="secondary-button mt-4 min-h-11 font-semibold text-accent-strong">View {match.profile.displayName}&apos;s profile</Link></article>)}</div>
    {page?.nextCursor && <Link className="secondary-button mt-6 min-h-11 font-semibold" href={`/discover?${new URLSearchParams({ cursor: page.nextCursor, limit: String(parsed.success ? parsed.data.limit : 20), ...(parsed.success && parsed.data.skillId ? { skillId: parsed.data.skillId } : {}),...(parsed.success&&parsed.data.availableOnly?{availableOnly:"true"}:{}) })}`}>Next matches</Link>}
  </section>;
}
