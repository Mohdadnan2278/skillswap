import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
import { listBookings } from "@/backend/bookings/service";
import { bookingQuerySchema } from "@/shared/validation";
import { formatSessionTime } from "@/shared/time";
import { BookingNotice } from "@/frontend/components/booking-notice";
import { HttpError } from "@/backend/http";
export default async function Bookings({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const {client,user}=await requirePageSession();const current=await getCurrentUser(client,user);if(!current.profile)redirect('/onboarding');
 const fields=Object.fromEntries(Object.entries(await searchParams).filter(([,v])=>v!==undefined&&v!==''));const query=bookingQuerySchema.safeParse(fields);
 let result;let message='';
 if(!query.success)message='Invalid filter or page link. Reset the list to continue.';
 else try {result=await listBookings(client,user.id,query.data);}catch(error){if(error instanceof HttpError&&error.status===400)message=error.message;else throw error;}
 return <section><h1 className="text-3xl font-bold">Your bookings</h1><BookingNotice/><form action="/bookings" className="mb-7 grid items-end gap-3 sm:flex sm:flex-wrap"><div><label htmlFor="booking-state" className="block font-semibold">Status</label><select id="booking-state" name="state" className="field" defaultValue={query.success?query.data.state??'':''}><option value="">All statuses</option>{['pending','accepted','rejected','cancelled','expired','completed','disputed'].map(state=><option key={state} value={state}>{state}</option>)}</select></div><div><label htmlFor="booking-role" className="block font-semibold">Your role</label><select id="booking-role" name="role" className="field" defaultValue={query.success?query.data.role??'':''}><option value="">Both roles</option><option value="teacher">Teaching</option><option value="learner">Learning</option></select></div><button className="primary-button">Apply filter</button></form>
 {message&&<p role="status" className="my-5 rounded-xl bg-slate-100 p-4">{message} <Link href="/bookings" className="underline">Reset bookings</Link></p>}
 {result?.items.length===0&&<div className="rounded-2xl bg-white p-6"><p>No bookings match this view yet.</p><Link href="/discover" className="mt-3 inline-flex min-h-11 items-center text-emerald-800 underline">Discover members</Link></div>}
 <div className="grid gap-4 sm:grid-cols-2">{result?.items.map(booking=><article key={booking.id} className="rounded-2xl border border-emerald-900/15 bg-white p-6"><p className="text-sm font-semibold uppercase text-emerald-800">{booking.state} · {booking.teacherId===user.id?'Teaching':'Learning'}</p><h2 className="mt-3 text-lg font-semibold">{formatSessionTime(booking.startsAt,current.timezone)}</h2><p className="mt-2 text-slate-600">{booking.durationMinutes} minutes · {current.timezone}</p><Link className="mt-3 inline-flex min-h-11 items-center font-semibold text-emerald-800 underline" href={`/bookings/${booking.id}`}>View booking</Link></article>)}</div>
 {result?.nextCursor&&query.success&&<Link className="mt-6 inline-flex min-h-11 items-center underline" href={`/bookings?${new URLSearchParams({cursor:result.nextCursor,limit:String(query.data.limit),...(query.data.state?{state:query.data.state}:{}),...(query.data.role?{role:query.data.role}:{})})}`}>Next bookings</Link>}
 </section>;
}
