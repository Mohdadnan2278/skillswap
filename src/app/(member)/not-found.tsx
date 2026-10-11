import Link from "next/link";

export default function MemberNotFound() {
  return <section className="mx-auto max-w-xl">
    <p className="text-sm font-semibold text-subtle">404</p>
    <h1 className="mt-3 text-3xl font-bold">Page unavailable</h1>
    <p className="my-5 leading-7 text-muted">This link may be out of date, or this page may not be available to your account. Choose where to go next.</p>
    <nav aria-label="Recovery actions" className="flex flex-wrap gap-3">
      <Link href="/bookings" className="primary-button">View bookings</Link>
      <Link href="/discover" className="secondary-button">Discover members</Link>
      <Link href="/dashboard" className="secondary-button">Return to dashboard</Link>
    </nav>
  </section>;
}
