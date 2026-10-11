"use client";
import { useEffect, useState } from "react";
import { sessionClock } from "@/shared/session-clock";

export function SessionScheduleClock({ startsAt, endsAt, serverNow }: { startsAt: string; endsAt: string; serverNow: string }) {
  const [now, setNow] = useState(Date.parse(serverNow));
  useEffect(() => {
    const baseline = performance.now(), server = Date.parse(serverNow);
    const tick = () => setNow(server + performance.now() - baseline);
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [serverNow]);
  const clock = sessionClock(startsAt, endsAt, now);
  const label = clock.phase === "before" ? "Time until scheduled start" : "Scheduled time remaining";
  return <section className="mt-6 rounded-2xl bg-emerald-50 p-5">
    <h2 className="text-xl font-semibold">Session schedule</h2>
    {clock.phase === "ended" ? <p className="mt-3 font-semibold">Scheduled session ended. Return to the booking to confirm completion.</p> : <><p className="mt-3 text-sm">{label}</p><p role="timer" aria-label={label} aria-live="off" className="mt-1 text-3xl font-bold tabular-nums">{clock.text}</p></>}
    <p className="mt-3 text-sm leading-6">This clock follows the booking for both Jitsi and Google Meet, including while Meet is open in another tab. Calls can open before the scheduled start. It shows scheduled time; actual call attendance is not recorded. Both participants confirm after the scheduled end before credits transfer.</p>
  </section>;
}
