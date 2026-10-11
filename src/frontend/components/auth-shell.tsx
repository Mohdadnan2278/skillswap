import Link from "next/link";
import { ThemeControl } from "@/frontend/components/theme-control";
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-4 py-6 sm:px-5 sm:py-14"><header className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="secondary-button min-h-11 px-2 text-xl font-bold text-accent-strong">SkillSwap</Link><ThemeControl/></header><div className="mt-5 rounded-2xl border border-line bg-surface p-4 sm:mt-8 sm:rounded-3xl sm:p-8"><h1 className="text-2xl font-bold sm:text-3xl">{title}</h1><p className="mb-6 mt-3 leading-7 text-muted">{description}</p>{children}</div></main>;
}
