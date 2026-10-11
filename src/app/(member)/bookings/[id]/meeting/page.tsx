import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
import { bookingView } from "@/backend/bookings/service";
import { meetingContext } from "@/backend/meetings/service";
import { HttpError } from "@/backend/http";
import { userIdSchema } from "@/shared/validation";
import { formatSessionTime } from "@/shared/time";
import { googleMeetLink } from "@/backend/meetings/google-meet";
import { SessionScheduleClock } from "@/frontend/components/session-schedule-clock";
import { BookingActions } from "@/frontend/components/booking-actions";
import { MeetingWorkspace } from "@/frontend/components/meeting-workspace";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { client, user } = await requirePageSession();
  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) notFound();
  const current = await getCurrentUser(client, user);
  if (!current.profile) redirect("/onboarding");
  let view;
  try { view = await bookingView(client, id); }
  catch (error) { if (error instanceof HttpError && error.code === "NOT_FOUND") notFound(); throw error; }
  const { booking, actions } = view;
  let allowed = false, message = "", serverNow = new Date().toISOString();
  try { serverNow = (await meetingContext(client, id)).serverNow; allowed = true; }
  catch (error) { if (error instanceof HttpError && error.status === 409) message = error.message; else throw error; }
  let meet = null;
  try { meet = await googleMeetLink(client, id); serverNow = meet.serverNow; }
  catch (error) { if (!(error instanceof HttpError && error.status === 409)) throw error; }
  const funded = booking.state === "accepted" && booking.creditReservationStatus === "held";
  const ended = Date.parse(serverNow) >= Date.parse(booking.endsAt);
  const confirmed = user.id === booking.teacherId ? booking.teacherConfirmed : booking.learnerConfirmed;
  const completion = <section className={funded && ended ? "sticky top-2 z-10 mt-4 rounded-2xl border border-control bg-surface p-4 shadow-lg" : "mt-4"} aria-label="Session completion">
    {funded && ended && <><h2 className="text-xl font-semibold">Finish your session</h2><p className="mt-2 text-sm leading-6">{confirmed ? "Your completion is recorded. Waiting for the other participant." : "Confirm only if the session took place. Both participants must confirm before credits transfer."}</p></>}
    <BookingActions id={id} actions={actions.filter(action => action === "confirm")} refreshWhileActive={funded} refreshSeconds={booking.isDemo ? 5 : 15}/>
    {funded && !ended && <SessionScheduleClock startsAt={booking.startsAt} endsAt={booking.endsAt} serverNow={serverNow} refreshAtEnd/>}
    {booking.state === "completed" && booking.creditReservationStatus === "settled" && <p role="status" className="font-semibold text-accent-strong">Session completed. The credit transfer is complete.</p>}
    {!funded && <Link className="secondary-button mt-3" href={`/bookings/${id}#session-actions`}>{booking.state === "completed" ? "View completed booking" : "Return to booking"}</Link>}
  </section>;
  return <section className="mx-auto max-w-4xl">
    <Link href={`/bookings/${id}`} className="secondary-button min-h-11 text-accent-strong">Back to booking</Link>
    <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Your video session</h1>
    <p className="mt-2 text-sm leading-6 text-muted">{formatSessionTime(booking.startsAt, current.timezone)} · {current.timezone} · {booking.durationMinutes} minutes</p>
    {message && <p role="status" className="mt-3 rounded-xl bg-warning p-3 text-sm">{message}</p>}
    <MeetingWorkspace id={id} allowed={allowed} configured={process.env.VIDEO_PROVIDER === "jitsi_demo"} meet={meet} completion={completion}/>
  </section>;
}
