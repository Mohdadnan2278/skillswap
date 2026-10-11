"use client";
import {useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {usePageRefresh} from './live-refresh';
import type {ApiResponse,Booking,BookingAction} from '@/shared/contracts';
export function BookingActions({id,actions,canResolveComplete=false,refreshWhileActive=false,refreshSeconds=15}:{id:string;actions:BookingAction[];canResolveComplete?:boolean;refreshWhileActive?:boolean;refreshSeconds?:number}) {
 const router=useRouter();const attempt=useRef<{fingerprint:string;key:string}|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [reason,setReason]=useState('');
 usePageRefresh(refreshWhileActive&&!busy,refreshSeconds);
 async function act(action:BookingAction,fields:{reason?:string;resolution?:'complete'|'cancel'}={}) {
  setBusy(true);setMessage('');const fingerprint=JSON.stringify({action,fields});
  if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,key:crypto.randomUUID()};
  try {
   const response=await fetch(`/api/v1/bookings/${id}/${action}`,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':attempt.current!.key},body:JSON.stringify(fields)});
   const result:ApiResponse<Booking>=await response.json();
   setMessage('error' in result?result.error.message:'Booking updated.');if(!('error' in result))attempt.current=null;router.refresh();
  }catch{setMessage('Could not confirm the update. Retry safely with the same details.');}finally{setBusy(false);}
 }
 function dispute(event:FormEvent<HTMLFormElement>){event.preventDefault();void act('dispute',{reason});}
 const buttons=actions.filter(action=>action!=='dispute'&&action!=='resolve');
 return <div aria-busy={busy}>{buttons.length>0&&<div className="mt-4 flex flex-wrap gap-3">{buttons.map(action=><button type="button" key={action} className={action==='accept'||action==='confirm'?'primary-button':'min-h-11 rounded-xl border border-control bg-surface px-5 py-3 font-semibold'} disabled={busy} onClick={()=>act(action)}>{action==='accept'?'Accept request':action==='reject'?'Reject request':action==='confirm'?'Confirm session completed':'Cancel booking'}</button>)}</div>}
 {actions.includes('dispute')&&<details className="mt-3 rounded-xl border border-warning-line bg-warning px-4"><summary className="flex min-h-11 cursor-pointer items-center font-semibold">Report a problem</summary><form onSubmit={dispute} className="pb-4"><label className="block font-semibold" htmlFor="dispute-reason">Describe the problem</label><textarea id="dispute-reason" className="field min-h-24" required minLength={10} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} disabled={busy}/><p className="my-3 text-sm leading-6">Credits stay reserved until both participants agree to complete or cancel. No automatic deadline or unilateral release applies.</p><button className="secondary-button" disabled={busy}>Open dispute</button></form></details>}
 {actions.includes('resolve')&&<section className="mt-6 rounded-xl bg-warning p-5"><h2 className="text-lg font-semibold">Choose a resolution</h2><p className="mt-2 text-sm leading-6">Both people must choose the same resolution. You may change your vote until resolved. Completing transfers credits; cancelling releases them. Credits remain held indefinitely while votes differ.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" className="primary-button" disabled={busy||!canResolveComplete} onClick={()=>act('resolve',{resolution:'complete'})}>Vote to complete</button><button type="button" className="min-h-11 rounded-xl border bg-surface px-4 py-3 font-semibold" disabled={busy} onClick={()=>act('resolve',{resolution:'cancel'})}>Vote to cancel</button></div>{!canResolveComplete&&<p className="mt-3 text-sm">Completing becomes available after the scheduled end.</p>}</section>}
 {message&&<p role="status" className="mt-4 rounded-xl bg-soft p-4">{message}</p>}</div>;
}
