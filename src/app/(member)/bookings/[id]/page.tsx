import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
import { bookingView } from "@/backend/bookings/service";
import { HttpError } from "@/backend/http";
import { userIdSchema } from "@/shared/validation";
import { creditsLabel } from "@/shared/credits";
import { formatSessionTime } from "@/shared/time";
import { BookingNotice } from "@/frontend/components/booking-notice";
import { BookingActions } from "@/frontend/components/booking-actions";
export default async function BookingDetail({params}:{params:Promise<{id:string}>}) {
 const {client,user}=await requirePageSession();const {id}=await params;if(!userIdSchema.safeParse(id).success)notFound();
 const current=await getCurrentUser(client,user);if(!current.profile)redirect('/onboarding');
 let view;try{view=await bookingView(client,id);}catch(error){if(error instanceof HttpError&&error.code==='NOT_FOUND')notFound();throw error;}
 const {booking,actions}=view;
 const [people,skill]=await Promise.all([client.from('profiles').select('id,display_name').in('id',[booking.teacherId,booking.learnerId]),client.from('skills').select('name').eq('id',booking.skillId).maybeSingle()]);
 if(people.error||skill.error)throw new HttpError(503,'DATABASE_UNAVAILABLE','Booking details are unavailable.');
 const name=(personId:string)=>people.data?.find(p=>p.id===personId)?.display_name??'Member';
 return <section className="mx-auto max-w-2xl"><Link href="/bookings" className="inline-flex min-h-11 items-center text-emerald-800 underline">Back to bookings</Link><h1 className="mt-4 text-3xl font-bold">Session booking</h1><BookingNotice legacy={booking.creditReservationStatus==="not_integrated"}/><p data-testid="booking-state" className="font-semibold uppercase text-emerald-800">{booking.state}</p><h2 className="mt-3 text-2xl font-semibold">{skill.data?.name??'Catalogue skill'}</h2><dl className="mt-6 space-y-4"><div><dt className="font-semibold">Teacher</dt><dd className="break-words">{name(booking.teacherId)}</dd></div><div><dt className="font-semibold">Learner</dt><dd className="break-words">{name(booking.learnerId)}</dd></div><div><dt className="font-semibold">Start · {current.timezone}</dt><dd>{formatSessionTime(booking.startsAt,current.timezone)}</dd></div><div><dt className="font-semibold">End · {current.timezone}</dt><dd>{formatSessionTime(booking.endsAt,current.timezone)}</dd></div><div><dt className="font-semibold">Duration</dt><dd>{booking.durationMinutes} minutes</dd></div>{booking.state==='pending'&&<div><dt className="font-semibold">Request expires · {current.timezone}</dt><dd>{formatSessionTime(booking.requestExpiresAt,current.timezone)}</dd></div>}</dl><p className="mt-5 font-semibold">Session value: {creditsLabel(booking.costUnits)} · Reservation: {booking.creditReservationStatus.replaceAll("_"," ")}</p><BookingActions id={id} actions={actions} canResolveComplete={view.canResolveComplete}/>{booking.state==='accepted'&&booking.creditReservationStatus==='held'&&<p className="mt-6 leading-7 text-slate-600">Teacher confirmation: {booking.teacherConfirmed?'recorded':'pending'}. Learner confirmation: {booking.learnerConfirmed?'recorded':'pending'}. Credits remain held until both confirm after the scheduled end.</p>}{booking.dispute&&<section className="mt-7 rounded-xl bg-amber-50 p-5"><h2 className="text-xl font-semibold">Dispute</h2><p className="mt-3 break-words whitespace-pre-wrap">{booking.dispute.reason}</p><p className="mt-3">Teacher vote: {booking.dispute.teacherResolution??'not chosen'}. Learner vote: {booking.dispute.learnerResolution??'not chosen'}.</p>{!booking.dispute.resolvedAt&&<p className="mt-3 font-semibold">Credits stay reserved indefinitely until both agree on a resolution.</p>}</section>}</section>;
}
