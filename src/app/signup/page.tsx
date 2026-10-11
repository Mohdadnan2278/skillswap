import { AuthShell } from "@/frontend/components/auth-shell";
import { AuthForm } from "@/frontend/components/auth-form";
import { isAuthConfigured, googleAuthEnabled } from "@/backend/config";
export const dynamic = "force-dynamic";
export default async function Signup() {
  return <AuthShell title="Join SkillSwap" description="One account to teach, learn, and grow with your community."><AuthForm mode="signup" configured={isAuthConfigured()} googleEnabled={await googleAuthEnabled()} /></AuthShell>;
}
