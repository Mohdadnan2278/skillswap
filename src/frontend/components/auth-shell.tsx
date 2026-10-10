import Link from "next/link";
export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-5 py-8 sm:py-14"><Link href="/" className="text-xl font-bold text-emerald-800">SkillSwap</Link><div className="mt-8 rounded-3xl border border-emerald-900/15 bg-white p-6 sm:p-8"><h1 className="text-3xl font-bold">{title}</h1><p className="mb-7 mt-3 leading-7 text-slate-600">{description}</p>{children}</div></main>;
}
