"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ApiResponse, Booking, CreateBookingRequest, Skill } from "@/shared/contracts";
import { creditsLabel } from "@/shared/credits";
import { localToUtc, formatSessionTime } from "@/shared/time";
import type {DemoPolicy} from '@/shared/demo';

export function BookingRequestForm({ teacherId, teacherName, skills, timezone, availableUnits, demo }: {
  teacherId: string; teacherName: string; skills: Skill[]; timezone: string; availableUnits: number; demo:DemoPolicy;
}) {
  const router = useRouter();
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [draft, setDraft] = useState({ skillId: skills[0]?.id ?? "", startsAt: "", durationMinutes: "60", startMode: "scheduled" as "scheduled" | "now" | "demo" });
  const [review, setReview] = useState<CreateBookingRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const reviewPane = useRef<HTMLElement>(null);
  useEffect(() => {
    if (review) {
      reviewPane.current?.scrollIntoView({ block: "start" });
      reviewPane.current?.focus({ preventScroll: true });
    }
  }, [review]);

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      if(draft.startMode==='demo'){
        if(!demo.enabled)throw new Error('Demo sessions are disabled. Reload to see the current settings.');
        if(demo.costUnits>availableUnits)throw new Error('You do not have enough available credits for this demo.');
        setReview({teacherId,skillId:draft.skillId,startMode:'demo',policyVersion:demo.version});return;
      }
      const durationMinutes = Number(draft.durationMinutes) as 30 | 60 | 90;
      if (durationMinutes > availableUnits) throw new Error("You do not have enough available credits. Check your wallet or choose a shorter session.");
      const fields = { teacherId, skillId: draft.skillId, durationMinutes };
      if (draft.startMode === "now") {
        setReview({ ...fields, startMode: "now" });
      } else {
        const startsAt = localToUtc(draft.startsAt, timezone);
        if (Date.parse(startsAt) < Date.now() + 15 * 60000 || Date.parse(startsAt) > Date.now() + 30 * 86400000) throw new Error("Choose a start between 15 minutes and 30 days ahead.");
        setReview({ ...fields, startsAt });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Check the session details.");
    }
  }

  async function send() {
    if (!review) return;
    setBusy(true); setMessage("");
    const fingerprint = JSON.stringify(review);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const response = await fetch("/api/v1/bookings", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": attempt.current!.key }, body: fingerprint });
      const result: ApiResponse<Booking> = await response.json();
      if ("error" in result) setMessage(result.error.message);
      else { router.push(`/bookings/${result.data.id}`); router.refresh(); }
    } catch {
      setMessage("Could not confirm the request. Retry with the same details; it will not create a duplicate.");
    } finally { setBusy(false); }
  }

  return <div>{!review ? <form onSubmit={prepare} className="space-y-5">
    <div>
      <label htmlFor="request-skill" className="block font-semibold">Skill</label>
      <select id="request-skill" name="skillId" className="field" value={draft.skillId} onChange={event => setDraft({ ...draft, skillId: event.target.value })} required>
        {skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
      </select>
    </div>
    <fieldset className="space-y-3">
      <legend className="mb-2 font-semibold">When do you want to meet?</legend>
      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-control bg-surface p-4">
        <input type="radio" name="startMode" value="now" checked={draft.startMode === "now"} onChange={() => setDraft({ ...draft, startMode: "now" })} aria-describedby="quick-call-help" />
        <span className="font-semibold">Start now</span>
      </label>
      <p id="quick-call-help" className="text-sm leading-6 text-muted">Join as soon as the teacher accepts. They have 5 minutes to accept after you send the request. The formal session start is set 5 minutes ahead.</p>
      {demo.enabled&&<><label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-warning-line bg-warning p-4"><input type="radio" name="startMode" value="demo" checked={draft.startMode==='demo'} onChange={()=>setDraft({...draft,startMode:'demo'})} aria-describedby="demo-call-help"/><span className="font-semibold">Demo session</span></label><p id="demo-call-help" className="text-sm leading-6 text-muted">{demo.durationMinutes} minute{demo.durationMinutes===1?'':'s'} · {creditsLabel(demo.costUnits)}, set by the administrator. Accept within 1 minute, then join immediately. Both confirm after the timer ends, about {demo.durationMinutes+1} minutes after requesting. Uses real credits; no public ratings.</p></>}
      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-control bg-surface p-4">
        <input type="radio" name="startMode" value="scheduled" checked={draft.startMode === "scheduled"} onChange={() => setDraft({ ...draft, startMode: "scheduled" })} />
        <span className="font-semibold">Schedule for later</span>
      </label>
    </fieldset>
    {draft.startMode === "scheduled" && <div>
      <label htmlFor="request-start" className="block font-semibold">Start date and time ({timezone})</label>
      <input id="request-start" name="startsAt" type="datetime-local" className="field" value={draft.startsAt} onChange={event => setDraft({ ...draft, startsAt: event.target.value })} required aria-describedby="start-help" />
      <p id="start-help" className="mt-2 text-sm text-muted">15 minutes to 30 days ahead. Times are shown in {timezone}. <Link href="/profile" className="underline">Change your timezone</Link>.</p>
    </div>}
    {draft.startMode!=='demo'&&<div>
      <label htmlFor="request-duration" className="block font-semibold">Duration</label>
      <select id="request-duration" name="durationMinutes" className="field" value={draft.durationMinutes} onChange={event => setDraft({ ...draft, durationMinutes: event.target.value })}>
        <option value="30">30 minutes · 0.5 credits</option><option value="60">60 minutes · 1 credit</option><option value="90">90 minutes · 1.5 credits</option>
      </select>
    </div>}
    <p className="text-sm">Available: {creditsLabel(availableUnits)}. <Link href="/wallet" className="underline">View wallet</Link></p>
    <button className="primary-button" disabled={availableUnits < 30}>Review request</button>
  </form> : <section ref={reviewPane} tabIndex={-1} className="scroll-mt-4 rounded-2xl bg-surface p-6" aria-label="Review your request" aria-busy={busy}>
    <h2 className="text-xl font-semibold">Review your request</h2>
    <dl className="mt-4 space-y-3">
      <div><dt className="text-sm text-subtle">Teacher</dt><dd>{teacherName}</dd></div>
      <div><dt className="text-sm text-subtle">Skill</dt><dd>{skills.find(skill => skill.id === review.skillId)?.name}</dd></div>
      {review.startMode === "now" || review.startMode === 'demo' ? <div><dt className="text-sm text-subtle">Call access</dt><dd>Immediately after the teacher accepts</dd></div> : <div><dt className="text-sm text-subtle">Start · {timezone}</dt><dd>{formatSessionTime(review.startsAt, timezone)}</dd></div>}
      <div><dt className="text-sm text-subtle">Duration</dt><dd>{review.startMode==='demo'?demo.durationMinutes:review.durationMinutes} minute{review.startMode==='demo'&&demo.durationMinutes===1?'':'s'}{review.startMode==='demo'?' · Demo session':''}</dd></div>
    </dl>
    {review.startMode === "now" && <p className="mt-5 rounded-xl bg-tint p-4 text-sm leading-6">The teacher must accept within 5 minutes of sending. You can then both join immediately. Your formal start and end times will appear on the booking.</p>}
    {review.startMode==='demo'&&<p className="mt-5 rounded-xl bg-warning p-4 text-sm leading-6">Demo session: accept within 1 minute. Completion opens about {demo.durationMinutes+1} minutes after sending. Both participants must confirm. No public ratings are recorded.</p>}
    <p className="my-5 text-sm leading-6 text-muted">This request reserves {creditsLabel(review.startMode==='demo'?demo.costUnits:review.durationMinutes)} from your available balance and holds time for both of you. {review.startMode==='demo'?'It expires in 1 minute if the teacher has not accepted.':review.startMode === "now" ? "It expires in 5 minutes if the teacher has not accepted." : "It expires after 24 hours or at the session start, whichever comes first."} Either person can cancel before the start. Rejection, cancellation or expiry releases the reservation. Both participants must confirm after the scheduled end before credits transfer.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="primary-button" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send request"}</button>
      <button type="button" className="min-h-11 px-3 font-semibold underline" disabled={busy} onClick={() => { setReview(null); setMessage(""); }}>Edit details</button>
    </div>
  </section>}{message && <p role="status" className="mt-5 rounded-xl bg-soft p-4">{message}</p>}</div>;
}
