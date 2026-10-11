import Link from "next/link";
import { AuthShell } from "@/frontend/components/auth-shell";

export default function NotFound() {
  return <AuthShell title="Page not found" description="This link may be incorrect or out of date. Choose where to go next.">
    <p className="mb-5 text-sm font-semibold text-subtle">404</p>
    <div className="flex flex-wrap gap-3">
      <Link href="/" className="primary-button">Return home</Link>
      <Link href="/login" className="secondary-button">Sign in</Link>
    </div>
  </AuthShell>;
}
