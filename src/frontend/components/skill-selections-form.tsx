"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ApiResponse, Skill, SkillSelections } from "@/shared/contracts";
export function SkillSelectionsForm({ skills, initial }: { skills: Skill[]; initial: SkillSelections }) {
  const router = useRouter();
  const [selected, setSelected] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  function toggle(key: keyof SkillSelections, id: string) {
    setMessage("");
    setSelected(previous => ({ ...previous, [key]: previous[key].includes(id) ? previous[key].filter(value => value !== id) : [...previous[key], id] }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/me/skills", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected) });
      const result: ApiResponse<SkillSelections> = await response.json();
      if ("error" in result) setMessage(result.error.message);
      else { setSelected(result.data); setMessage("Your skills are saved. Discovery now uses your wanted skills."); router.refresh(); }
    } catch { setMessage("Could not save. Your choices are still here; please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} aria-busy={busy} className="mt-10 border-t border-emerald-900/15 pt-8">
    <h2 className="text-2xl font-bold">Your skills</h2><p className="mt-3 leading-7 text-slate-600">Choose up to 20 skills in each list. You can teach and learn the same skill. Save your choices before discovering members.</p>
    {skills.length === 0 && <p role="status" className="mt-4">The catalogue is empty. Please try again later.</p>}
    {([['offeredSkillIds', 'I can teach'], ['wantedSkillIds', 'I want to learn']] as const).map(([key, label]) => <fieldset key={key} disabled={busy} className="mt-6"><legend className="text-lg font-semibold">{label} <span className="font-normal text-slate-500">({selected[key].length}/20)</span></legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{skills.map(skill => <label key={skill.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-emerald-900/15 bg-white px-4 py-3"><input type="checkbox" className="h-5 w-5 shrink-0 accent-emerald-700" checked={selected[key].includes(skill.id)} disabled={!selected[key].includes(skill.id) && selected[key].length >= 20} onChange={() => toggle(key, skill.id)} /><span>{skill.name}<span className="block text-xs text-slate-500">{skill.category}</span></span></label>)}</div></fieldset>)}
    <div className="mt-6 flex flex-wrap items-center gap-4"><button className="primary-button" disabled={busy || skills.length === 0}>{busy ? "Saving skills…" : "Save skills"}</button><Link href="/discover" className="min-h-11 py-3 font-semibold text-emerald-800 underline">Discover members</Link></div>
    {message && <p role="status" className="mt-4 rounded-xl bg-slate-100 p-4">{message}</p>}
  </form>;
}
