import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
export default async function Dashboard() {
  const { client, user } = await requirePageSession();
  const current = await getCurrentUser(client, user);
  if (!current.profile) redirect("/onboarding");
  return <section><p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">Your community starts here</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">Welcome, {current.profile.displayName}</h1><p className="mt-4 max-w-2xl leading-7 text-slate-600">Your account and profile are ready. Everyone can teach and learn; there are no fixed teacher or student roles.</p><div className="mt-8 grid gap-5 sm:grid-cols-2"><article className="rounded-2xl border border-emerald-900/15 bg-white p-6"><h2 className="text-xl font-semibold">Your introduction</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">{current.profile.bio || "Add a short bio to introduce yourself."}</p><Link href="/profile" className="mt-4 inline-flex min-h-11 items-center font-semibold text-emerald-800 underline">Edit profile</Link></article><article className="rounded-2xl bg-emerald-900 p-6 text-white"><h2 className="text-xl font-semibold">What comes next</h2><p className="mt-3 leading-7 text-emerald-100">Skills and discovery arrive in Phase 4. Bookings, credits, video, and community ratings are not available yet.</p></article></div></section>;
}
