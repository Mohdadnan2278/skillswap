export function sessionClock(startsAt: string, endsAt: string, now: number) {
  const start = Date.parse(startsAt), end = Date.parse(endsAt);
  const phase = now < start ? "before" : now < end ? "during" : "ended";
  const seconds = Math.max(0, Math.ceil(((phase === "before" ? start : end) - now) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = String(Math.floor(seconds % 3600 / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return { phase, text: `${hours ? `${hours}:` : ""}${minutes}:${remainder}` };
}
