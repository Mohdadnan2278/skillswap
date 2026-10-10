"use client";
import { useRef,useState,type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ApiResponse,Booking,CreateBookingRequest,Skill } from "@/shared/contracts";
import { creditsLabel } from "@/shared/credits";
import { localToUtc,formatSessionTime } from "@/shared/time";
export function BookingRequestForm({teacherId,teacherName,skills,timezone,availableUnits}:{teacherId:string;teacherName:string;skills:Skill[];timezone:string;availableUnits:number}) {
 const router=useRouter(); const attempt=useRef<{fingerprint:string;key:string}|null>(null);
 const [draft,setDraft]=useState({skillId:skills[0]?.id??"",startsAt:"",durationMinutes:"60"});
 const [review,setReview]=useState<CreateBookingRequest|null>(null); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 function prepare(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setMessage("");const form=new FormData(event.currentTarget);setDraft({skillId:String(form.get("skillId")),startsAt:String(form.get("startsAt")),durationMinutes:String(form.get("durationMinutes"))});
  try {
   const startsAt=localToUtc(String(form.get("startsAt")),timezone);
   const minutes=Number(form.get("durationMinutes")) as 30|60|90;
   if (Date.parse(startsAt)<Date.now()+15*60000 || Date.parse(startsAt)>Date.now()+30*86400000) throw new Error("Choose a start between 15 minutes and 30 days ahead.");
   if(minutes>availableUnits)throw new Error("You do not have enough available credits. Check your wallet or choose a shorter session.");
   setReview({teacherId,skillId:String(form.get("skillId")),startsAt,durationMinutes:minutes});
  } catch(error) { setMessage(error instanceof Error?error.message:"Check the session details."); }
 }
 async function send() {
  if (!review) return;
  setBusy(true);setMessage("");const fingerprint=JSON.stringify(review);
  if (attempt.current?.fingerprint!==fingerprint) attempt.current={fingerprint,key:crypto.randomUUID()};
  try {
   const response=await fetch("/api/v1/bookings",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":attempt.current!.key},body:fingerprint});
   const result:ApiResponse<Booking>=await response.json();
   if ("error" in result) setMessage(result.error.message);
   else {router.push(`/bookings/${result.data.id}`);router.refresh();}
  } catch {setMessage("Could not confirm the request. Retry with the same details; it will not create a duplicate.");}
  finally {setBusy(false);}
 }
 return <div>{!review?<form onSubmit={prepare} className="space-y-5"><div><label htmlFor="request-skill" className="block font-semibold">Skill</label><select id="request-skill" name="skillId" className="field" defaultValue={draft.skillId} required>{skills.map(skill=><option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></div><div><label htmlFor="request-start" className="block font-semibold">Start date and time ({timezone})</label><input id="request-start" name="startsAt" type="datetime-local" className="field" defaultValue={draft.startsAt} required aria-describedby="start-help" /><p id="start-help" className="mt-2 text-sm text-slate-600">15 minutes to 30 days ahead. Times are shown in {timezone}. <Link href="/profile" className="underline">Change your timezone</Link>.</p></div><div><label htmlFor="request-duration" className="block font-semibold">Duration</label><select id="request-duration" name="durationMinutes" className="field" defaultValue={draft.durationMinutes}><option value="30">30 minutes · 0.5 credits</option><option value="60">60 minutes · 1 credit</option><option value="90">90 minutes · 1.5 credits</option></select></div><p className="text-sm">Available: {creditsLabel(availableUnits)}. <Link href="/wallet" className="underline">View wallet</Link></p><button className="primary-button" disabled={availableUnits<30}>Review request</button></form>:<section className="rounded-2xl bg-white p-6" aria-busy={busy}><h2 className="text-xl font-semibold">Review your request</h2><dl className="mt-4 space-y-3"><div><dt className="text-sm text-slate-500">Teacher</dt><dd>{teacherName}</dd></div><div><dt className="text-sm text-slate-500">Skill</dt><dd>{skills.find(skill=>skill.id===review.skillId)?.name}</dd></div><div><dt className="text-sm text-slate-500">Start · {timezone}</dt><dd>{formatSessionTime(review.startsAt,timezone)}</dd></div><div><dt className="text-sm text-slate-500">Duration</dt><dd>{review.durationMinutes} minutes</dd></div></dl><p className="my-5 text-sm leading-6 text-slate-600">This request reserves {creditsLabel(review.durationMinutes)} from your available balance and holds time for both of you. It expires after 24 hours or at the session start, whichever comes first. Either person can cancel before the start. Rejection, cancellation or expiry releases the reservation. Both participants must confirm after the scheduled end before credits transfer.</p><div className="flex flex-wrap gap-3"><button type="button" className="primary-button" disabled={busy} onClick={send}>{busy?"Sending…":"Send request"}</button><button type="button" className="min-h-11 px-3 font-semibold underline" disabled={busy} onClick={()=>{setReview(null);setMessage("");}}>Edit details</button></div></section>}{message&&<p role="status" className="mt-5 rounded-xl bg-slate-100 p-4">{message}</p>}</div>;
}
