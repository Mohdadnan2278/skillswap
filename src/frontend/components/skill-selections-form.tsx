"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ApiResponse, Skill, SkillSelections } from "@/shared/contracts";
import { skillCategories, type CustomSkillResult } from "@/shared/skills";

export function SkillSelectionsForm({ skills, initial }: { skills: Skill[]; initial: SkillSelections }) {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState(skills);
  const [selected, setSelected] = useState(initial);
  const [operation, setOperation] = useState<"save" | "create" | null>(null);
  const [message, setMessage] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [customErrors, setCustomErrors] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [dirty, setDirty] = useState(false);
  const busy = operation !== null;
  const visible = catalogue.filter(skill => (!category || skill.category === category) && skill.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const categories = [...new Set(catalogue.map(skill => skill.category))].sort();

  function toggle(key: keyof SkillSelections, id: string) {
    setMessage(""); setDirty(true);
    setSelected(previous => ({ ...previous, [key]: previous[key].includes(id) ? previous[key].filter(value => value !== id) : [...previous[key], id] }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setOperation("save"); setMessage("");
    try {
      const response = await fetch("/api/v1/me/skills", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selected) });
      const result: ApiResponse<SkillSelections> = await response.json();
      if ("error" in result) setMessage(result.error.message);
      else { setSelected(result.data); setDirty(false); setCustomMessage(""); setMessage("Your skills are saved. Discovery now uses your wanted skills."); router.refresh(); }
    } catch { setMessage("Could not save. Your choices are still here; please try again."); }
    finally { setOperation(null); }
  }
  async function addCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    const direction = fields.get("direction");
    const keys: (keyof SkillSelections)[] = direction === "both" ? ["offeredSkillIds", "wantedSkillIds"] : [direction === "teach" ? "offeredSkillIds" : "wantedSkillIds"];
    if (keys.some(key => selected[key].length >= 20)) { setCustomMessage("You have selected 20 skills in that list. Remove one before adding another."); return; }
    setOperation("create"); setCustomMessage(""); setCustomErrors({});
    try {
      const response = await fetch("/api/v1/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: fields.get("name"), category: fields.get("category") }) });
      const result: ApiResponse<CustomSkillResult> = await response.json();
      if ("error" in result) { setCustomMessage(result.error.message); setCustomErrors(result.error.fieldErrors ?? {}); return; }
      const { skill, created } = result.data;
      setCatalogue(previous => previous.some(value => value.id === skill.id) ? previous : [...previous, skill].sort((a, b) => a.name.localeCompare(b.name)));
      setSelected(previous => {
        const next = { ...previous };
        for (const key of keys) if (!next[key].includes(skill.id)) next[key] = [...next[key], skill.id];
        return next;
      });
      setSearch(""); setCategory(""); setDirty(true); setMessage(""); form.reset();
      setCustomMessage(`${created ? "Added" : "Found existing skill:"} ${skill.name}. Save your skills to update your profile.`);
    } catch { setCustomMessage("Could not add the skill. Your entries are still here; retrying the same name will not create a duplicate."); }
    finally { setOperation(null); }
  }
  return <section id="skills" className="mt-10 border-t border-emerald-900/15 pt-8" aria-labelledby="skills-title">
    <h2 id="skills-title" className="text-2xl font-bold">Your skills</h2>
    <p className="mt-3 leading-7 text-slate-600">Choose what you can teach and want to learn. Select up to 20 in each list, or add a skill of your own.</p>
    <details className="mt-5 rounded-2xl border border-emerald-900/15 bg-white p-4 sm:p-5">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-emerald-800">Can’t find your skill? Add a custom skill</summary>
      <p className="mt-3 text-sm leading-6 text-slate-600">Give it a clear name so others can find it. Matching names use the same skill; new skills join the shared catalogue.</p>
      <form onSubmit={addCustom} aria-busy={operation === "create"} className="mt-4 space-y-4">
        <div><label htmlFor="custom-skill-name" className="font-semibold">Custom skill name</label><input id="custom-skill-name" name="name" className="field" placeholder="e.g. Baking, Figma or Malayalam" minLength={2} maxLength={60} required disabled={busy} aria-invalid={Boolean(customErrors.name)} aria-describedby="custom-name-error" /><p id="custom-name-error" className="field-error">{customErrors.name?.join(" ")}</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="custom-category" className="font-semibold">Skill category</label><select id="custom-category" name="category" className="field" defaultValue="Other" disabled={busy}>{skillCategories.map(value => <option key={value}>{value}</option>)}</select></div><div><label htmlFor="custom-direction" className="font-semibold">Add to my list</label><select id="custom-direction" name="direction" className="field" defaultValue="learn" disabled={busy}><option value="learn">I want to learn</option><option value="teach">I can teach</option><option value="both">Both lists</option></select></div></div>
        <button className="secondary-button w-full sm:w-auto" disabled={busy}>{operation === "create" ? "Adding skill…" : "Add custom skill"}</button>
        {customMessage && <p role="status" className="rounded-xl bg-slate-100 p-4 text-sm leading-6">{customMessage}</p>}
      </form>
    </details>
    <form onSubmit={submit} aria-busy={operation === "save"} className="mt-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><div><label htmlFor="skill-search" className="font-semibold">Search skills</label><input id="skill-search" type="search" className="field" placeholder="Find a skill…" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} disabled={busy} /></div><div><label htmlFor="skill-category" className="font-semibold">Filter category</label><select id="skill-category" className="field" value={category} onChange={event => setCategory(event.target.value)} disabled={busy}><option value="">All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></div></div>
      {catalogue.length === 0 && <p className="mt-4">Add a custom skill to get started.</p>}
      {catalogue.length > 0 && visible.length === 0 && <p className="mt-4 text-sm text-slate-600">No skills match your search. Try another name or add a custom skill above.</p>}
      {([['offeredSkillIds', 'I can teach'], ['wantedSkillIds', 'I want to learn']] as const).map(([key, label]) => <fieldset key={key} disabled={busy} className="mt-6 min-w-0"><legend className="text-lg font-semibold">{label} <span className="font-normal text-slate-500">({selected[key].length}/20)</span></legend>
        {selected[key].length > 0 && <ul aria-label={`Selected skills: ${label}`} className="mt-3 flex flex-wrap gap-2">{selected[key].map(id => <li key={id} className="min-w-0 max-w-full"><button type="button" disabled={busy} onClick={() => toggle(key, id)} aria-label={`Remove ${catalogue.find(skill => skill.id === id)?.name ?? "unavailable skill"} from ${label}`} className="flex min-h-11 max-w-full items-center gap-2 rounded-full bg-emerald-100 px-3 py-2 text-left text-sm font-semibold text-emerald-900"><span className="min-w-0 break-words">{catalogue.find(skill => skill.id === id)?.name ?? "Unavailable skill"}</span><span aria-hidden="true">×</span></button></li>)}</ul>}
        <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto overscroll-contain rounded-xl p-1 sm:grid-cols-2">{visible.map(skill => <label key={skill.id} className={`flex min-h-14 min-w-0 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 ${selected[key].includes(skill.id) ? "border-emerald-600 bg-emerald-50" : "border-emerald-900/15 bg-white"}`}><input type="checkbox" className="h-5 w-5 shrink-0 accent-emerald-700" checked={selected[key].includes(skill.id)} disabled={!selected[key].includes(skill.id) && selected[key].length >= 20} onChange={() => toggle(key, skill.id)} /><span className="min-w-0 break-words">{skill.name}<span className="block text-xs text-slate-500">{skill.category}</span></span></label>)}</div>
      </fieldset>)}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"><button className="primary-button w-full sm:w-auto" disabled={busy || catalogue.length === 0}>{operation === "save" ? "Saving skills…" : "Save skills"}</button><Link href="/discover" className="inline-flex min-h-11 items-center justify-center font-semibold text-emerald-800 underline">Discover members</Link></div>
      {dirty && <p className="mt-3 text-sm font-medium text-amber-800">You have unsaved skill choices.</p>}
      {message && <p role="status" className="mt-4 rounded-xl bg-slate-100 p-4">{message}</p>}
    </form>
  </section>;
}
