"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ApiResponse } from "@/shared/contracts";

type AuthResult = { redirectTo?: string | null; verificationRequired?: boolean };
export function AuthForm({ mode, configured, googleEnabled }: { mode: "login" | "signup"; configured: boolean; googleEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setErrors({});
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "signup" && form.get("password") !== form.get("confirmPassword")) { setErrors({ confirmPassword: ["Passwords must match."] }); return; }
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const result: ApiResponse<AuthResult> = await response.json();
      if ("error" in result) { setMessage(result.error.message); setErrors(result.error.fieldErrors ?? {}); if (result.error.code === "EMAIL_UNVERIFIED") setResendEmail(String(form.get("email"))); return; }
      if (result.data.verificationRequired) { setResendEmail(String(form.get("email"))); setConfirmationSent(true); setMessage("Check your email for a confirmation link, then return here to sign in. Check your spam folder too."); }
      else { router.replace(result.data.redirectTo ?? "/dashboard"); router.refresh(); }
    } catch { setMessage("Could not connect. Check your connection and try again."); }
    finally { setBusy(false); }
  }
  async function resend() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: resendEmail }) });
      const result: ApiResponse<{ message: string }> = await response.json();
      setMessage("error" in result ? result.error.message : result.data.message);
    } catch { setMessage("Could not connect. Please try again."); }
    finally { setBusy(false); }
  }
  async function google() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result: ApiResponse<AuthResult> = await response.json();
      if ("error" in result) setMessage(result.error.message);
      else if (result.data.redirectTo) window.location.assign(result.data.redirectTo);
    } catch { setMessage("Could not connect to Google sign-in. Please try again."); }
    finally { setBusy(false); }
  }
  return <div>
    {!configured && <p role="status" className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Authentication needs Supabase configuration. Follow docs/SUPABASE_SETUP.md to connect this app.</p>}
    <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
      <div><label htmlFor="email" className="block font-semibold">Email</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} className="field" /><p id="email-error" className="field-error">{errors.email?.join(" ")}</p></div>
      <div><label htmlFor="password" className="block font-semibold">Password</label><input id="password" name="password" type="password" required minLength={mode === "signup" ? 8 : undefined} maxLength={128} autoComplete={mode === "signup" ? "new-password" : "current-password"} aria-invalid={Boolean(errors.password)} aria-describedby={mode === "signup" ? "password-hint password-error" : "password-error"} className="field" />{mode === "signup" && <p id="password-hint" className="mt-2 text-sm text-slate-600">At least 8 characters. Use a unique password.</p>}<p id="password-error" className="field-error">{errors.password?.join(" ")}</p></div>
      {mode === "signup" && <div><label htmlFor="confirmPassword" className="block font-semibold">Confirm password</label><input className="field" id="confirmPassword" name="confirmPassword" type="password" required maxLength={128} autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} aria-describedby="confirmPassword-error" /><p id="confirmPassword-error" className="field-error">{errors.confirmPassword?.join(" ")}</p></div>}
      <button disabled={busy || !configured || confirmationSent} className="primary-button w-full">{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}</button>
    </form>
    {message && <p role="status" className="mt-5 rounded-xl bg-slate-100 p-4 text-sm">{message}</p>}
    {resendEmail && <button type="button" onClick={resend} disabled={busy} className="secondary-button mt-4 w-full">Resend confirmation</button>}
    {googleEnabled && <button onClick={google} disabled={busy || !configured} className="secondary-button mt-4 w-full">Continue with Google</button>}
    <p className="mt-6 text-sm text-slate-600">{mode === "signup" ? "Already have an account? " : "New to SkillSwap? "}<Link href={mode === "signup" ? "/login" : "/signup"} className="font-semibold text-emerald-800 underline">{mode === "signup" ? "Sign in" : "Create an account"}</Link></p>
  </div>;
}
