import Link from "next/link";
import { requirePageSession } from "@/backend/auth/session";
import { LogoutButton } from "@/frontend/components/logout-button";
export const dynamic = "force-dynamic";
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession();
  return <div className="mx-auto max-w-5xl px-5"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-900/15 py-5"><Link href="/" className="text-2xl font-bold text-emerald-800">SkillSwap</Link><nav aria-label="Member navigation" className="flex flex-wrap items-center gap-4"><Link className="rounded-lg px-2 py-3 font-semibold" href="/dashboard">Dashboard</Link><Link className="rounded-lg px-2 py-3 font-semibold" href="/profile">Profile</Link><LogoutButton /></nav></header><main className="py-8 sm:py-12">{children}</main></div>;
}
