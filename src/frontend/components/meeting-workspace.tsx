"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { MeetingClient } from "@/frontend/components/meeting-client";
import { GoogleMeetClient } from "@/frontend/components/google-meet-client";

export function MeetingWorkspace({ id, allowed, configured, meet, completion }: {
  id: string; allowed: boolean; configured: boolean;
  meet: { canEdit: boolean; url: string | null } | null;
  completion: ReactNode;
}) {
  const [provider, setProvider] = useState<"jitsi" | "google">("jitsi");
  const [callActive, setCallActive] = useState(false);
  const workspace = useRef<HTMLElement>(null);
  const activity = useCallback((active: boolean) => {
    setCallActive(active);
    if (active) requestAnimationFrame(() => workspace.current?.scrollIntoView({ block: "start" }));
  }, []);
  return <>
    {completion}
    <section ref={workspace} className="mt-5 scroll-mt-4" aria-label="Video workspace">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose video provider">
        <button type="button" aria-pressed={provider === "jitsi"} disabled={callActive} className={provider === "jitsi" ? "primary-button" : "secondary-button"} onClick={() => setProvider("jitsi")}>Use Jitsi</button>
        {meet && <button type="button" aria-pressed={provider === "google"} disabled={callActive} className={provider === "google" ? "primary-button" : "secondary-button"} onClick={() => setProvider("google")}>Use Google Meet</button>}
      </div>
      {callActive && <p className="mt-2 text-sm text-muted">Leave the Jitsi call before switching providers.</p>}
      {provider === "jitsi" ? <div>
        <h2 className="mb-3 mt-4 text-xl font-semibold">Join with Jitsi</h2>
        <MeetingClient id={id} allowed={allowed} configured={configured} onActivityChange={activity}/>
      </div> : <div>
        {meet && <GoogleMeetClient id={id} canEdit={meet.canEdit} initialUrl={meet.url} allowJoin={allowed}/>}
      </div>}
    </section>
  </>;
}
