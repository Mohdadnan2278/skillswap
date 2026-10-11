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
import {googleMeetLink} from '@/backend/meetings/google-meet';
import {GoogleMeetClient} from '@/frontend/components/google-meet-client';
import {SessionScheduleClock} from '@/frontend/components/session-schedule-clock';
export default async function MeetingPage({params}:{params:Promise<{id:string}>}){
 const {client,user}=await requirePageSession();const {id}=await params;if(!userIdSchema.safeParse(id).success)notFound();const current=await getCurrentUser(client,user);if(!current.profile)redirect('/onboarding');
 let booking;try{booking=await getBooking(client,id);}catch(e){if(e instanceof HttpError&&e.code==='NOT_FOUND')notFound();throw e;}
 let allowed=false,message='';try{await meetingContext(client,id);allowed=true;}catch(e){if(e instanceof HttpError&&e.status===409)message=e.message;else throw e;}
 let meet=null;try{meet=await googleMeetLink(client,id);}catch(e){if(!(e instanceof HttpError&&e.status===409))throw e;}
 return <section className="mx-auto max-w-4xl"><Link href={`/bookings/${id}`} className="inline-flex min-h-11 items-center text-emerald-800 underline">Back to booking</Link><h1 className="mt-5 text-3xl font-bold">Your video session</h1><p className="mt-4 leading-7">Scheduled: {formatSessionTime(booking.startsAt,current.timezone)} · {current.timezone} · {booking.durationMinutes} minutes</p>{message&&<p role="status" className="mt-4 rounded-xl bg-amber-50 p-4">{message}</p>}{meet&&<><SessionScheduleClock key={meet.serverNow} startsAt={booking.startsAt} endsAt={booking.endsAt} serverNow={meet.serverNow}/><GoogleMeetClient id={id} canEdit={meet.canEdit} initialUrl={meet.url} allowJoin={allowed}/></>}<h2 className="mt-8 text-2xl font-semibold">Join with Jitsi</h2><MeetingClient id={id} allowed={allowed} configured={process.env.VIDEO_PROVIDER==='jitsi_demo'}/></section>;
}
