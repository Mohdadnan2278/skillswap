import Link from "next/link";
import { requirePageSession } from "@/backend/auth/session";
import { MemberNavigation } from "@/frontend/components/member-navigation";
export const dynamic = "force-dynamic";
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const {isAdmin} = await requirePageSession();
  return <div className="mx-auto max-w-5xl px-4 sm:px-6"><a href="#main-content" className="sr-only rounded-xl bg-white p-3 font-semibold focus:not-sr-only focus:absolute focus:z-30">Skip to content</a><header className="relative flex items-center justify-between gap-3 border-b border-emerald-900/15 py-4"><Link href="/dashboard" className="shrink-0 text-2xl font-bold tracking-tight text-emerald-800">SkillSwap</Link><MemberNavigation isAdmin={isAdmin} /></header><main id="main-content" className="min-w-0 py-7 sm:py-10">{children}</main></div>;
}
