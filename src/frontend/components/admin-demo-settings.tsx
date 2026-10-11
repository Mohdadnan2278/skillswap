'use client';
import {useState,type FormEvent} from 'react';
import type {AdminCommand} from '@/shared/admin';
import type {DemoPolicy} from '@/shared/demo';
import {creditsLabel} from '@/shared/credits';
type Command=Extract<AdminCommand,{action:'configure_demo'}>;
export function AdminDemoSettings({policy,busy,onReview}:{policy:DemoPolicy;busy:boolean;onReview:(command:Omit<Command,'reason'>)=>void}){
 const [enabled,setEnabled]=useState(policy.enabled),[duration,setDuration]=useState(String(policy.durationMinutes)),[cost,setCost]=useState(String(policy.costUnits));
 function review(event:FormEvent<HTMLFormElement>){event.preventDefault();onReview({action:'configure_demo',enabled,durationMinutes:Number(duration),costUnits:Number(cost) as Command['costUnits'],version:policy.version});}
 return <form onSubmit={review} className="mt-6 space-y-5 rounded-xl border bg-white p-5">
  <h2 className="text-xl font-semibold">Credit-transfer demo</h2>
  <p className="text-sm leading-6">Current settings: {policy.enabled?'enabled':'disabled'} · {policy.durationMinutes} minute{policy.durationMinutes===1?'':'s'} · {creditsLabel(policy.costUnits)}. Changes apply to new demo requests.</p>
  <label className="flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} disabled={busy}/>Enable demo sessions</label>
  <div><label className="block font-semibold" htmlFor="demo-duration">Demo duration (minutes)</label><input id="demo-duration" type="number" min={1} max={10} step={1} required className="field mt-2" value={duration} onChange={e=>setDuration(e.target.value)} disabled={busy}/></div>
  <div><label className="block font-semibold" htmlFor="demo-cost">Demo credit cost</label><select id="demo-cost" className="field mt-2" value={cost} onChange={e=>setCost(e.target.value)} disabled={busy}>{[30,60,90,120,150,180].map(units=><option key={units} value={units}>{creditsLabel(units)}</option>)}</select></div>
  <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6">For a fast walkthrough, choose 1 minute and 0.5 credits. The teacher has 1 minute to accept, and both can join immediately. Completion opens about {Number(duration)+1} minutes after requesting. Both must confirm to transfer the reserved credits.</p>
  <p className="text-sm leading-6">Participants must explicitly choose Demo session. This uses real available credits and excludes public ratings. Existing bookings keep their original time and cost.</p>
  <button className="primary-button" disabled={busy}>Review demo settings</button>
 </form>;
}
