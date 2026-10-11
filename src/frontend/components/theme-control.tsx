"use client";

import { useEffect, useSyncExternalStore } from "react";
import { themeStorageKey as storageKey, type ThemePreference } from "@/shared/theme";

const changeEvent = "skillswap-theme-change";
let memoryPreference: ThemePreference | undefined;

function readPreference(): ThemePreference {
  if (memoryPreference) return memoryPreference;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* The theme still works when browser storage is unavailable. */ }
  return "system";
}

function applyPreference() {
  const preference = readPreference();
  document.documentElement.dataset.theme = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
}

function subscribe(notify: () => void) {
  window.addEventListener(changeEvent, notify);
  return () => window.removeEventListener(changeEvent, notify);
}

export function ThemeObserver() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyPreference();
    const storage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      memoryPreference = undefined;
      applyPreference();
      window.dispatchEvent(new Event(changeEvent));
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("storage", storage);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return null;
}

export function ThemeControl() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  return <label className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-line bg-surface pl-2">
    <span className="sr-only">Color theme</span>
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 text-accent"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
    <select aria-label="Color theme" value={preference} className="min-h-11 max-w-24 cursor-pointer rounded-xl bg-transparent py-2 pl-1 pr-2 text-sm font-semibold" onChange={event => {
      const choice = event.target.value;
      if (choice !== "light" && choice !== "dark" && choice !== "system") return;
      memoryPreference = choice;
      try { localStorage.setItem(storageKey, choice); } catch { /* Keep the choice for this visit. */ }
      applyPreference();
      window.dispatchEvent(new Event(changeEvent));
    }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
  </label>;
}
