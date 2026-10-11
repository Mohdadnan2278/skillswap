/** Accept copied Google sharing parameters; persist and open only the meeting code. */
export function canonicalGoogleMeetUrl(input: string): string | null {
  const value = input.trim();
  if (input.length > 2048 || [...input].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || !/^https:\/\/meet\.google\.com\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "meet.google.com" || url.username || url.password || url.port || !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(url.pathname)) return null;
    return `https://meet.google.com${url.pathname}`;
  } catch { return null; }
}
