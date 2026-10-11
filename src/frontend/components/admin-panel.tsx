'use client';
import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {adminSections,adminCommandSchema,type AdminCommand,type AdminData,type AdminQuery} from '@/shared/admin';
import type {ApiResponse} from '@/shared/contracts';
import {demoPolicySchema} from '@/shared/demo';
import {creditsLabel} from '@/shared/credits';
import {AdminDemoSettings} from './admin-demo-settings';

const labels:Record<string,string>={suspend_member:'Suspend member',restore_member:'Restore member',grant_admin:'Grant admin access',revoke_admin:'Revoke admin access',enable_skill:'Enable skill',disable_skill:'Disable skill',hide_feedback:'Hide feedback',restore_feedback:'Restore feedback',review_dispute:'Record dispute review',cancel_stuck_booking:'Cancel and release held credits',configure_demo:'Configure demo sessions',create_skill:'Create skill'};
type ItemAction=Exclude<AdminCommand['action'],'create_skill'|'configure_demo'>;
type Pending={action:ItemAction;target:string;label:string}|{action:'create_skill';slug:string;name:string;category:string;label:string}|(Omit<Extract<AdminCommand,{action:'configure_demo'}>,'reason'>&{label:string});
function text(value:unknown){return value==null?'—':typeof value==='object'?JSON.stringify(value):String(value);}
function title(value:string){return value.replaceAll('_',' ').replace(/\b[a-z]/g,s=>s.toUpperCase());}
export function AdminPanel({query,data,actorId}:{query:AdminQuery;data:AdminData;actorId:string}){
 const router=useRouter();const [pending,setPending]=useState<Pending|null>(null);const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [blocked,setBlocked]=useState(false);
 const retry=useRef<{signature:string;key:string}|null>(null);
 const confirmation=useRef<HTMLFormElement>(null);
 useEffect(()=>{if(pending){confirmation.current?.scrollIntoView({block:'start'});document.getElementById('admin-reason')?.focus({preventScroll:true});}},[pending]);
 function stage(value:Pending){setPending(value);setReason('');setMessage('');}
 function addSkill(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);stage({action:'create_skill',slug:String(f.get('slug')),name:String(f.get('name')),category:String(f.get('category')),label:String(f.get('name'))});}
 async function commit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!pending)return;const {label:_,...draft}=pending;void _;
  const parsed=adminCommandSchema.safeParse({...draft,reason});if(!parsed.success){setMessage(parsed.error.issues.map(x=>x.message).join(' '));return;}
  const signature=JSON.stringify(parsed.data);if(retry.current?.signature!==signature)retry.current={signature,key:crypto.randomUUID()};
  setBusy(true);setMessage('');try{
   const response=await fetch('/api/v1/admin',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':retry.current.key},body:signature});
   const result:ApiResponse<{auditId:string;targetId:string}>=await response.json();
   if('error' in result){setMessage(result.error.message);if(response.status===401||response.status===403)setBlocked(true);return;}
   retry.current=null;setPending(null);setReason('');setMessage('Action saved and recorded in the audit log.');router.refresh();
  }catch{setMessage('The result is uncertain. Refresh and check the audit log. Retrying this same action uses the same key.');}finally{setBusy(false);}
 }
 const pageLink=(page:number)=>'/admin?'+new URLSearchParams({section:query.section,page:String(page),search:query.search});
 const action=(name:ItemAction,id:string,label:string)=><button type="button" disabled={busy} className="secondary-button" onClick={()=>stage({action:name,target:id,label})}>{labels[name]}</button>;
 const demoRow=data.rows[0];const demo=demoPolicySchema.safeParse(demoRow?{enabled:demoRow.enabled,durationMinutes:demoRow.duration_minutes,costUnits:demoRow.cost_units,version:demoRow.version}:null);
 if(blocked)return <section><h1 className="text-3xl font-bold">Admin access unavailable</h1><p role="status" className="mt-4">{message}</p><Link className="secondary-button mt-4" href="/dashboard">Return to dashboard</Link></section>;
 return <section><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold text-accent-strong">SkillSwap management</p><h1 className="mt-2 text-3xl font-bold">Administration</h1></div><button className="secondary-button" type="button" disabled={busy} onClick={()=>router.refresh()}>Refresh</button></div>
  <p className="mt-4 text-muted">Actions require a reason and are audited. Bookings and wallet balances are preserved; credit transfers still require participant confirmation.</p>
  <nav aria-label="Admin sections" className="mt-6 flex flex-wrap gap-2">{adminSections.map(section=><Link key={section} href={'/admin?section='+section} aria-current={query.section===section?'page':undefined} className={query.section===section?'primary-button':'secondary-button'}>{title(section)}</Link>)}</nav>
  {query.section==='demo'?(demo.success?<AdminDemoSettings key={demo.data.version} policy={demo.data} busy={busy} onReview={command=>stage({...command,label:`${command.enabled?'Enable':'Disable'} demo sessions · ${command.durationMinutes} minutes · ${creditsLabel(command.costUnits)}`})}/>:<p role="alert" className="mt-6">Demo settings are unavailable. Refresh and try again.</p>):query.section==='overview'?<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(data.counts).map(([key,value])=><div key={key} className="rounded-xl border bg-surface p-5"><h2 className="text-sm font-semibold text-muted">{title(key.replace(/([a-z])([A-Z])/g,'$1 $2'))}</h2><p className="mt-2 text-3xl font-bold">{value}</p></div>)}</div>:<>
   <form method="get" className="mt-6 flex flex-wrap items-end gap-3"><input type="hidden" name="section" value={query.section}/><div className="min-w-0 flex-1"><label htmlFor="admin-search" className="font-semibold">Search {query.section}</label><input id="admin-search" name="search" type="search" maxLength={100} defaultValue={query.search} className="field mt-2"/></div><button className="primary-button">Search</button><Link className="secondary-button" href={'/admin?section='+query.section}>Clear</Link></form>
   <p className="mt-5 text-sm text-muted">{data.total} result{data.total===1?'':'s'} · Page {query.page+1}</p>
   {query.section==='skills'&&<form onSubmit={addSkill} className="mt-6 rounded-xl border bg-surface p-5"><h2 className="text-xl font-semibold">Add a catalogue skill</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><label htmlFor="skill-name">Name</label><input id="skill-name" name="name" className="field" required minLength={2} maxLength={80}/></div><div><label htmlFor="skill-slug">Slug</label><input id="skill-slug" name="slug" className="field" required minLength={2} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="digital-art"/></div><div><label htmlFor="skill-category">Category</label><input id="skill-category" name="category" className="field" required minLength={2} maxLength={60}/></div></div><button className="secondary-button mt-4" disabled={busy}>Review new skill</button></form>}
   {query.section==='disputes'&&<p className="mt-5 rounded-xl bg-warning p-4">Staff can review and record notes. Participants can agree to complete or cancel. An uninvolved administrator can release an eligible stuck reservation after 24 hours past the end, or for a suspended participant.</p>}
   <div className="mt-6 space-y-4">{data.rows.map(row=>{const id=text(row.id);const label=text(row.display_name??row.name??row.skill??row.reviewer??row.action??row.id);return <article key={id} className="min-w-0 rounded-xl border bg-surface p-5"><h2 className="break-words text-xl font-semibold">{label}</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(row).map(([key,value])=><div key={key} className="min-w-0"><dt className="text-sm font-semibold text-muted">{title(key)}{key.endsWith('_units')?' (minute units; 60 = 1 credit)':''}</dt><dd className="whitespace-pre-wrap break-words">{text(value)}</dd></div>)}</dl><div className="mt-5 flex flex-wrap gap-3">
    {query.section==='members'&&!row.is_admin&&<>{action(row.suspended?'restore_member':'suspend_member',id,label)}{!row.suspended&&action('grant_admin',id,label)}</>}
    {query.section==='members'&&row.is_admin===true&&id!==actorId&&action('revoke_admin',id,label)}
    {query.section==='skills'&&action(row.enabled?'disable_skill':'enable_skill',id,label)}
    {query.section==='feedback'&&action(row.hidden?'restore_feedback':'hide_feedback',id,label)}
    {query.section==='disputes'&&!row.resolved_at&&action('review_dispute',id,label)}
    {['bookings','disputes'].includes(query.section)&&['accepted','disputed'].includes(String(row.state))&&row.credit_reservation_status==='held'&&action('cancel_stuck_booking',id,label)}
   </div></article>;})}</div>
   {!data.rows.length&&<p className="mt-6 rounded-xl bg-surface p-5">No {query.section} match this filter.</p>}
   <div className="mt-6 flex flex-wrap gap-4">{query.page>0&&<Link className="secondary-button" href={pageLink(query.page-1)}>Previous page</Link>}{(query.page+1)*25<data.total&&query.page<4000&&<Link className="secondary-button" href={pageLink(query.page+1)}>Next page</Link>}</div>
  </>}
  {pending&&<form ref={confirmation} onSubmit={commit} aria-label="Confirm admin action" className="mt-7 scroll-mt-4 rounded-xl border-2 border-warning-strong bg-warning p-5"><h2 className="text-xl font-semibold">{labels[pending.action]}</h2><p className="mt-2 break-words">Selected: {pending.label}</p>{pending.action==='cancel_stuck_booking'&&<p className="mt-3 font-semibold">This cancels the session and releases the learner’s reserved credits. It cannot pay the teacher or refund a settled session. A reason and audit are required.</p>}<label className="mt-4 block font-semibold" htmlFor="admin-reason">Reason or review note</label><textarea id="admin-reason" value={reason} onChange={e=>setReason(e.target.value)} required minLength={10} maxLength={500} rows={3} className="field mt-2" disabled={busy}/><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} className="primary-button">{busy?'Saving…':'Confirm action'}</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>setPending(null)}>Cancel</button></div></form>}
  {message&&<p role="status" className="mt-5 rounded-xl bg-soft p-4">{message}</p>}
 </section>;
}
