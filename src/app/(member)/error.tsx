"use client";
import Link from "next/link";
export default function MemberError({ retry }: { retry: () => void }) {
  return <section className="mx-auto max-w-xl"><h1 className="text-2xl font-bold">We couldn’t load your account</h1><p className="my-4 leading-7 text-muted">Check your connection and try again. Your session changes may have been saved; review the booking or wallet before trying another action.</p><div className="flex flex-wrap gap-3"><button onClick={retry} className="primary-button">Try again</button><Link href="/dashboard" className="secondary-button">Return to dashboard</Link></div></section>;
}
