/** Convert a wall-clock minute in an IANA timezone; reject gaps and repeated DST times. */
export function localToUtc(value: string, timezone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Choose a date and time.");
  const [, y, mo, d, h, mi] = match.map(Number);
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) throw new Error("Choose a valid date and time.");
  const target = Date.UTC(y,mo-1,d,h,mi);
  if (new Date(target).toISOString().slice(0,16) !== value) throw new Error("Choose a valid date and time.");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  function wall(instant: number) {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
    return Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  }
  const offsets = new Set<number>();
  for (let hours=-36; hours<=36; hours+=6) { const sample=target+hours*3600000; offsets.add(wall(sample)-sample); }
  const candidates = [...offsets].map(offset => target-offset).filter(instant => wall(instant) === target);
  if (!candidates.length) throw new Error("This time does not exist because the clocks change. Choose another time.");
  if (candidates.length > 1) throw new Error("This time occurs twice because the clocks change. Choose an unambiguous time.");
  return new Date(candidates[0]).toISOString();
}
export function formatSessionTime(instant: string, timezone: string) {
  return new Intl.DateTimeFormat("en", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(instant));
}
