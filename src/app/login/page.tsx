import { AuthShell } from "@/frontend/components/auth-shell";
import { AuthForm } from "@/frontend/components/auth-form";
import { isAuthConfigured, googleAuthEnabled } from "@/backend/config";
export const dynamic = "force-dynamic";
const notices: Record<string, string> = { verify: "Confirm your email, then sign in.", callback: "That sign-in or confirmation link is invalid or expired. Try signing in or use Resend confirmation after signing in with an unconfirmed account.", suspended: "This account is suspended. Contact your SkillSwap administrator.", setup: "Authentication configuration is incomplete." };
export default async function Login({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  return <AuthShell title="Welcome back" description="Sign in to your SkillSwap account.">{notice && notices[notice] && <p role="status" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm">{notices[notice]}</p>}<AuthForm mode="login" configured={isAuthConfigured()} googleEnabled={await googleAuthEnabled()} /></AuthShell>;
}
