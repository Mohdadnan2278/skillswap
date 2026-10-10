"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) { setError("Could not sign out. Try again."); return; }
      router.replace("/login"); router.refresh();
    } catch { setError("Could not connect. Try again."); }
    finally { setBusy(false); }
  }
  return <div><button className="secondary-button" onClick={logout} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="status" className="field-error">{error}</p>}</div>;
}
