import Link from "next/link";
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-4 py-6 sm:px-5 sm:py-14"><Link href="/" className="inline-flex min-h-11 items-center text-xl font-bold text-emerald-800">SkillSwap</Link><div className="mt-5 rounded-2xl border border-emerald-900/15 bg-white p-4 sm:mt-8 sm:rounded-3xl sm:p-8"><h1 className="text-2xl font-bold sm:text-3xl">{title}</h1><p className="mb-6 mt-3 leading-7 text-slate-600">{description}</p>{children}</div></main>;
}
