"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse, CurrentUser } from "@/shared/contracts";
export function ProfileForm({ current, onboarding = false }: { current: CurrentUser; onboarding?: boolean }) {
  const timezoneRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setErrors({});
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/me/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: data.get("displayName"), bio: data.get("bio"), college: data.get("college"), timezone: data.get("timezone") }) });
      const result: ApiResponse<CurrentUser> = await response.json();
      if ("error" in result) { setMessage(result.error.message); setErrors(result.error.fieldErrors ?? {}); }
      else if (onboarding) { router.replace("/dashboard"); router.refresh(); }
      else setMessage("Your profile is saved.");
    } catch { setMessage("Could not save. Your entries are still here; please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
    <div><label htmlFor="displayName" className="block font-semibold">Display name</label><input className="field" id="displayName" name="displayName" autoComplete="nickname" defaultValue={current.profile?.displayName ?? ""} required minLength={2} maxLength={60} aria-invalid={Boolean(errors.displayName)} aria-describedby="displayName-error" /><p id="displayName-error" className="field-error">{errors.displayName?.join(" ")}</p></div>
    <div><label htmlFor="college" className="block font-semibold">College <span className="font-normal text-slate-500">(optional)</span></label><input className="field" id="college" name="college" autoComplete="organization" defaultValue={current.profile?.college ?? ""} maxLength={120} aria-invalid={Boolean(errors.college)} aria-describedby="college-error" /><p id="college-error" className="field-error">{errors.college?.join(" ")}</p></div>
    <div><label htmlFor="bio" className="block font-semibold">About you <span className="font-normal text-slate-500">(optional)</span></label><textarea className="field min-h-32" id="bio" name="bio" defaultValue={current.profile?.bio ?? ""} maxLength={500} aria-invalid={Boolean(errors.bio)} aria-describedby="bio-hint bio-error" /><p id="bio-hint" className="mt-2 text-sm text-slate-600">Up to 500 characters. Your name, college and bio are visible to signed-in members. Avoid sharing private contact details.</p><p id="bio-error" className="field-error">{errors.bio?.join(" ")}</p></div>
    <div><label htmlFor="timezone" className="block font-semibold">Timezone</label><input className="field" id="timezone" name="timezone" ref={timezoneRef} defaultValue={current.timezone} required maxLength={100} aria-invalid={Boolean(errors.timezone)} aria-describedby="timezone-hint timezone-error" /><p id="timezone-hint" className="mt-2 text-sm text-slate-600">Use an IANA timezone such as Asia/Kolkata. This preference is private.</p><button type="button" className="mt-2 min-h-11 text-sm font-semibold text-emerald-800 underline" onClick={() => { if (timezoneRef.current) timezoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone; }}>Use my device timezone</button><p id="timezone-error" className="field-error">{errors.timezone?.join(" ")}</p></div>
    <button className="primary-button" disabled={busy}>{busy ? "Saving…" : onboarding ? "Finish setup" : "Save profile"}</button>
    {message && <p role="status" className="rounded-xl bg-slate-100 p-4">{message}</p>}
  </form>;
}
