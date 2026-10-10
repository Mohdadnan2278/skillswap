import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {requirePageSession} from '@/backend/auth/session';
import {getCurrentUser} from '@/backend/profiles/service';
import {getBooking} from '@/backend/bookings/service';
import {meetingContext} from '@/backend/meetings/service';
import {MeetingClient} from '@/frontend/components/meeting-client';
import {HttpError} from '@/backend/http';
import {userIdSchema} from '@/shared/validation';
import {formatSessionTime} from '@/shared/time';
export default async function MeetingPage({params}:{params:Promise<{id:string}>}){
 const {client,user}=await requirePageSession();const {id}=await params;if(!userIdSchema.safeParse(id).success)notFound();const current=await getCurrentUser(client,user);if(!current.profile)redirect('/onboarding');
 let booking;try{booking=await getBooking(client,id);}catch(e){if(e instanceof HttpError&&e.code==='NOT_FOUND')notFound();throw e;}
 let allowed=false,message='';try{await meetingContext(client,id);allowed=true;}catch(e){if(e instanceof HttpError&&e.status===409)message=e.message;else throw e;}
 return <section className="mx-auto max-w-4xl"><Link href={`/bookings/${id}`} className="inline-flex min-h-11 items-center text-emerald-800 underline">Back to booking</Link><h1 className="mt-5 text-3xl font-bold">Video session demo</h1><p className="mt-4 leading-7">Scheduled: {formatSessionTime(booking.startsAt,current.timezone)} · {current.timezone} · {booking.durationMinutes} minutes</p>{message&&<p role="status" className="mt-4 rounded-xl bg-amber-50 p-4">{message}</p>}<MeetingClient id={id} allowed={allowed} configured={process.env.VIDEO_PROVIDER==='jitsi_demo'}/></section>;
}
