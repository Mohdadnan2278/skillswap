import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
import {readAvailability} from '@/backend/availability/service';
import {AvailabilityControl} from '@/frontend/components/availability-control';
export default async function Dashboard() {
  const { client, user } = await requirePageSession();
  const current = await getCurrentUser(client, user);
  if (!current.profile) redirect("/onboarding");
  const availability=await readAvailability(client,user.id);
  return <section><p className="text-sm font-semibold uppercase tracking-widest text-accent">Your community starts here</p><h1 className="mt-3 text-3xl font-bold sm:text-4xl">Welcome, {current.profile.displayName}</h1><p className="mt-4 max-w-2xl leading-7 text-muted">Your next skill starts with a conversation. Share what you know, meet a learning partner, and grow together.</p><nav aria-label="Quick actions" className="mt-5 flex flex-wrap gap-3"><Link href="/bookings" className="primary-button">View bookings</Link><Link href="/wallet" className="secondary-button">View wallet</Link><Link href="/notifications" className="secondary-button">View notifications</Link></nav><div className="mt-8 grid gap-5 sm:grid-cols-2"><article className="rounded-2xl border border-line bg-surface p-6"><h2 className="text-xl font-semibold">Your introduction</h2><p className="mt-3 whitespace-pre-wrap leading-7 text-muted">{current.profile.bio || "Add a short bio to introduce yourself."}</p><Link href="/profile" className="secondary-button mt-4 min-h-11 font-semibold text-accent-strong">Edit profile</Link></article><article className="rounded-2xl bg-emerald-900 p-6 text-white"><h2 className="text-xl font-semibold">Find your next skill</h2><p className="mt-3 leading-7 text-emerald-100">Choose the skills you can teach and want to learn in your profile, then discover members who can help.</p><Link href="/discover" className="secondary-button mt-4 min-h-11 font-semibold">Discover members</Link></article></div><AvailabilityControl initial={availability}/></section>;
}
