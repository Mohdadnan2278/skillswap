"use client";
import { useRef,useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiResponse,Booking } from "@/shared/contracts";
export function BookingActions({id,actions}:{id:string;actions:('accept'|'reject'|'cancel')[]}) {
 const router=useRouter();const keys=useRef<Record<string,string>>({});const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function act(action:string) {
  setBusy(true);setMessage("");keys.current[action]??=crypto.randomUUID();
  try {
   const response=await fetch(`/api/v1/bookings/${id}/${action}`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":keys.current[action]},body:"{}"});
   const result:ApiResponse<Booking>=await response.json();
   setMessage("error" in result?result.error.message:"Booking updated.");router.refresh();
  } catch {setMessage("Could not confirm the update. Retry safely with the same action.");}
  finally {setBusy(false);}
 }
 return <div aria-busy={busy}><div className="mt-6 flex flex-wrap gap-3">{actions.map(action=><button type="button" key={action} className={action==='accept'?"primary-button":"min-h-11 rounded-xl border border-emerald-900/20 bg-white px-5 py-3 font-semibold"} disabled={busy} onClick={()=>act(action)}>{action==='accept'?"Accept request":action==='reject'?"Reject request":"Cancel booking"}</button>)}</div>{message&&<p role="status" className="mt-4 rounded-xl bg-slate-100 p-4">{message}</p>}</div>;
}
