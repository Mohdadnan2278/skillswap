"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sessionClock } from "@/shared/session-clock";

export function SessionScheduleClock({ startsAt, endsAt, serverNow, refreshAtEnd = false, completionHref }: { startsAt: string; endsAt: string; serverNow: string; refreshAtEnd?: boolean; completionHref?: string }) {
  const router = useRouter();
  const notifiedEnd = useRef(Date.parse(serverNow) >= Date.parse(endsAt) ? endsAt : null);
  const [now, setNow] = useState(Date.parse(serverNow));
  useEffect(() => {
    const baseline = performance.now(), server = Date.parse(serverNow);
    const tick = () => setNow(server + performance.now() - baseline);
    tick();
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [serverNow]);
  const clock = sessionClock(startsAt, endsAt, now);
  useEffect(() => {
    if (clock.phase === "ended" && refreshAtEnd && notifiedEnd.current !== endsAt) {
      notifiedEnd.current = endsAt;
      router.refresh();
    }
  }, [clock.phase, endsAt, refreshAtEnd, router]);
  const label = clock.phase === "before" ? "Time until scheduled start" : "Scheduled time remaining";
  return <section className="mt-4 rounded-2xl bg-tint p-4" aria-label="Session schedule">
    {clock.phase === "ended" ? <><p role="status" className="font-semibold">Scheduled session ended. Both participants can now confirm completion.</p>{completionHref && <Link className="secondary-button mt-3" href={completionHref}>Return to booking to finish</Link>}</> : <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">{label}</p><p role="timer" aria-label={label} aria-live="off" className="text-2xl font-bold tabular-nums">{clock.text}</p></div>}
    <details className="mt-2"><summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-accent-strong">How session timing works</summary><p className="text-sm leading-6 text-muted">This clock follows the booking for both Jitsi and Google Meet, including while Meet is open in another tab. It shows scheduled time; actual call attendance is not recorded. Both participants confirm after the scheduled end before credits transfer.</p></details>
  </section>;
}
