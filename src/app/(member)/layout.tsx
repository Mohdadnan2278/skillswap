import Link from "next/link";
import { requirePageSession } from "@/backend/auth/session";
import { MemberNavigation } from "@/frontend/components/member-navigation";
import { ThemeControl } from "@/frontend/components/theme-control";
export const dynamic = "force-dynamic";
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const {isAdmin} = await requirePageSession();
  return <div className="mx-auto max-w-5xl px-4 sm:px-6"><a href="#main-content" className="sr-only rounded-xl bg-surface p-3 font-semibold focus:not-sr-only focus:absolute focus:z-30">Skip to content</a><header className="relative flex flex-wrap items-center gap-2 border-b border-line py-4 sm:gap-3"><Link href="/dashboard" className="mr-auto shrink-0 text-xl font-bold tracking-tight text-accent-strong sm:text-2xl">SkillSwap</Link><ThemeControl/><div className="lg:order-3 lg:w-full"><MemberNavigation isAdmin={isAdmin}/></div></header><main id="main-content" className="min-w-0 py-6 sm:py-10">{children}</main></div>;
}
