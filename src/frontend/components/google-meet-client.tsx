'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResponse } from '@/shared/contracts';
import { googleMeetInputSchema, googleMeetUrlSchema } from '@/shared/validation';
type LinkSettings = { url: string | null; canEdit: boolean; serverNow: string; closesAt: string };

export function GoogleMeetClient({ id, canEdit, initialUrl, allowJoin = false }: { id: string; canEdit: boolean; initialUrl: string | null; allowJoin?: boolean }) {
  const [input, setInput] = useState(initialUrl ?? ''), [savedUrl, setSavedUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false), [blocked, setBlocked] = useState(false), [message, setMessage] = useState('');
  const [grant, setGrant] = useState<{ url: string; expires: number } | null>(null);
  const working = useRef(false), reading = useRef(false), editing = useRef(false), version = useRef(0), knownUrl = useRef(initialUrl);

  const applyUrl = useCallback((url: string | null) => {
    if (url !== knownUrl.current) setGrant(null);
    knownUrl.current = url;
    setSavedUrl(url);
    if (!editing.current) setInput(url ?? '');
  }, []);

  const refreshLink = useCallback(async (manual = false, signal?: AbortSignal) => {
    if (working.current || reading.current) return;
    reading.current = true;
    const snapshot = version.current;
    try {
      const response = await fetch(`/api/v1/bookings/${id}/google-meet`, { cache: 'no-store', signal });
      const result: ApiResponse<LinkSettings> = await response.json();
      if (signal?.aborted || snapshot !== version.current) return;
      if ('error' in result) {
        if ([401, 403, 404, 409].includes(response.status)) { setBlocked(true); setGrant(null); }
        if (manual || [401, 403, 404, 409].includes(response.status)) setMessage(result.error.message);
        return;
      }
      if (result.data.url !== null && !googleMeetUrlSchema.safeParse(result.data.url).success) throw Error();
      setBlocked(false); applyUrl(result.data.url);
      if (manual) setMessage(result.data.url ? 'The saved Meet link is up to date.' : 'No Meet link has been saved yet. Ask the teacher to create a meeting and save its link.');
    } catch {
      if (manual && !signal?.aborted) setMessage('Could not refresh the Meet link. Check your connection and retry.');
    } finally { reading.current = false; }
  }, [id, applyUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { void refreshLink(false, controller.signal); };
    refresh();
    const interval = setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); controller.abort(); };
  }, [refreshLink, initialUrl]);

  useEffect(() => {
    if (!grant) return;
    const timer = setTimeout(() => { setGrant(null); setMessage('The SkillSwap call window has ended.'); }, Math.max(0, grant.expires - Date.now()));
    return () => clearTimeout(timer);
  }, [grant]);

  async function submit(join: boolean, remove = false) {
    if (working.current) return;
    working.current = true; version.current++;
    setBusy(true); setMessage(''); setGrant(null);
    try {
      let url: string | null = null;
      if (!join && !remove) {
        const parsed = googleMeetInputSchema.safeParse(input);
        if (!parsed.success) { setMessage(parsed.error.issues[0].message); return; }
        url = parsed.data;
      }
      const response = await fetch(`/api/v1/bookings/${id}/${join ? 'google-meet-access' : 'google-meet'}`, { method: join ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(join ? {} : { url }) });
      const result: ApiResponse<LinkSettings> = await response.json();
      if ('error' in result) { setMessage(result.error.fieldErrors?.url?.[0] ?? result.error.message); return; }
      if (result.data.url !== null && !googleMeetUrlSchema.safeParse(result.data.url).success) throw Error();
      if (join) {
        if (!result.data.url) throw Error();
        applyUrl(result.data.url);
        setGrant({ url: result.data.url, expires: Date.now() + Date.parse(result.data.closesAt) - Date.parse(result.data.serverNow) });
        setMessage('Meet is ready. Open it in a new tab and use Google’s camera, microphone and admission controls.');
      } else {
        editing.current = false; applyUrl(result.data.url);
        setMessage(result.data.url ? 'Google Meet link saved for both participants.' : 'Google Meet link removed.');
      }
    } catch { setMessage('Could not update Google Meet. Check your connection and retry.'); }
    finally { working.current = false; setBusy(false); }
  }

  return <section className="mt-7 rounded-2xl border border-line bg-surface p-5">
    <h2 className="text-xl font-semibold">Google Meet option</h2>
    {allowJoin && <div className="mt-3 flex flex-wrap gap-3">{grant ? <a href={grant.url} target="_blank" rel="noopener noreferrer" className="primary-button">Open Google Meet in a new tab</a> : <button className="primary-button" type="button" disabled={busy || blocked || !savedUrl} onClick={() => void submit(true)}>{busy ? 'Checking…' : 'Prepare Google Meet'}</button>}</div>}
    {message && <p role="status" className="mt-3 break-words rounded-xl bg-soft p-3 text-sm">{message}</p>}
    <p className="mt-3 leading-6">The teacher creates a meeting in Google Meet and adds its link here. Calls open in a new tab; Google controls admission and may require sign-in. Jitsi remains available. Joining or leaving transfers no credits.</p>
    {canEdit && <>
      <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer" className="secondary-button mt-3 min-h-11 font-semibold text-accent-strong">Create a Google Meet meeting</a>
      <p className="mt-2 text-sm leading-6">Create the meeting, copy its link, then return here and save it. Extra sharing parameters are removed automatically.</p>
      <form className="mt-4" onSubmit={event => { event.preventDefault(); void submit(false); }}>
        <label className="block font-semibold" htmlFor="google-meet-url">Google Meet link</label>
        <input id="google-meet-url" type="url" maxLength={2048} value={input} disabled={busy || blocked} onChange={event => { editing.current = true; setInput(event.target.value); }} placeholder="https://meet.google.com/abc-defg-hij" className="field" />
        <div className="mt-3 flex flex-wrap gap-3"><button className="secondary-button" disabled={busy || blocked} type="submit">Save Meet link</button>{savedUrl && <button className="secondary-button" disabled={busy || blocked} type="button" onClick={() => void submit(false, true)}>Remove Meet link</button>}</div>
      </form>
    </>}
    {!canEdit && <p className="mt-4" role="status">{savedUrl ? 'The teacher has added a Meet link.' : 'The teacher has not added a Meet link yet. This screen updates automatically when they save it. You can still use Jitsi.'}</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button className="secondary-button" type="button" disabled={busy} onClick={() => void refreshLink(true)}>Refresh Meet link</button>
    </div>
    <p className="mt-4 text-sm leading-6 text-muted">Links are shared only with booking participants in SkillSwap. A copied link can stay usable outside the app, including after cancellation or the join window.</p>
  </section>;
}
