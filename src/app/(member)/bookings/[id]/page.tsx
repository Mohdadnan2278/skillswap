import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageSession } from "@/backend/auth/session";
import { getCurrentUser } from "@/backend/profiles/service";
import { bookingView } from "@/backend/bookings/service";
import { HttpError } from "@/backend/http";
import { userIdSchema } from "@/shared/validation";
import { creditsLabel } from "@/shared/credits";
import { formatSessionTime } from "@/shared/time";
import { BookingNotice } from "@/frontend/components/booking-notice";
import { BookingActions } from "@/frontend/components/booking-actions";
import { googleMeetLink } from "@/backend/meetings/google-meet";
import { GoogleMeetClient } from "@/frontend/components/google-meet-client";
import { bookingFeedback } from "@/backend/feedback/service";
import { SessionScheduleClock } from "@/frontend/components/session-schedule-clock";
import { FeedbackForm } from "@/frontend/components/feedback-form";

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { client, user } = await requirePageSession();
  const { id } = await params;
  if (!userIdSchema.safeParse(id).success) notFound();
  const current = await getCurrentUser(client, user);
  if (!current.profile) redirect("/onboarding");
  let view;
  try { view = await bookingView(client, id); }
  catch (error) { if (error instanceof HttpError && error.code === "NOT_FOUND") notFound(); throw error; }
  const { booking, actions } = view;
  const review = booking.state === "completed" && !booking.isDemo ? await bookingFeedback(client, id, user.id) : null;
  const funded = booking.state === "accepted" && booking.creditReservationStatus === "held";
  let meet = null;
  if (funded) {
    try { meet = await googleMeetLink(client, id); }
    catch (error) { if (!(error instanceof HttpError && error.status === 409)) throw error; }
  }
  const serverNow = meet?.serverNow ?? new Date().toISOString();
  const ended = Date.parse(serverNow) >= Date.parse(booking.endsAt);
  const confirmed = user.id === booking.teacherId ? booking.teacherConfirmed : booking.learnerConfirmed;
  const [people, skill] = await Promise.all([
    client.from("profiles").select("id,display_name").in("id", [booking.teacherId, booking.learnerId]),
    client.from("skills").select("name").eq("id", booking.skillId).maybeSingle(),
  ]);
  if (people.error || skill.error) throw new HttpError(503, "DATABASE_UNAVAILABLE", "Booking details are unavailable.");
  const name = (personId: string) => people.data?.find(person => person.id === personId)?.display_name ?? "Member";
  return <section className="mx-auto max-w-2xl">
    <Link href="/bookings" className="inline-flex min-h-11 items-center text-accent-strong underline">Back to bookings</Link>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Session booking</h1><p data-testid="booking-state" className="rounded-full bg-selected px-3 py-1 text-sm font-semibold uppercase text-accent-deep">{booking.state}</p></div>
    <section id="session-actions" className="mt-5 scroll-mt-4 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="session-actions-title">
      <h2 id="session-actions-title" className="text-xl font-semibold">{booking.state === "completed" ? "Session completed" : funded && ended ? "Finish your session" : "Session controls"}</h2>
      <BookingActions id={id} actions={actions} canResolveComplete={view.canResolveComplete} refreshWhileActive={["pending", "accepted", "disputed"].includes(booking.state)} refreshSeconds={booking.isDemo ? 5 : 15}/>
      {funded && ended && <p role="status" className="mt-3 text-sm leading-6">{confirmed ? "Your completion is recorded. Waiting for the other participant." : "Confirm only if the session took place. Credits transfer after both participants confirm."}</p>}
      {funded && <><Link className={`${ended ? "secondary-button" : "primary-button"} mt-4`} href={`/bookings/${id}/meeting`}>{ended ? "Return to call" : "Prepare for call"}</Link>{!ended && <SessionScheduleClock startsAt={booking.startsAt} endsAt={booking.endsAt} serverNow={serverNow} refreshAtEnd/>}</>}
      {booking.state === "completed" && booking.creditReservationStatus === "settled" && <p className="mt-3 font-semibold text-accent-strong">Both participants confirmed. The credit transfer is complete.</p>}
    </section>
    {!booking.isDemo && booking.state === "completed" && booking.creditReservationStatus === "settled" && (review ? <section className="mt-6 rounded-xl bg-surface p-5"><h2 className="text-xl font-semibold">Your published feedback</h2><p className="mt-3">{review.rating} / 5 stars</p><p className="mt-3 whitespace-pre-wrap break-words">{review.comment}</p><p className="mt-3 text-sm text-muted">{review.hidden ? "This feedback is hidden from community pages by moderation. Your original review is preserved." : "Feedback is immutable and visible to signed-in members."}</p></section> : <FeedbackForm id={id}/>)}
    <section className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-labelledby="booking-details-title">
      <h2 id="booking-details-title" className="text-2xl font-semibold">{skill.data?.name ?? "Catalogue skill"}</h2>
      {booking.isDemo && <p className="mt-4 rounded-xl bg-warning p-4 text-sm leading-6">Demo session · {booking.durationMinutes} minute{booking.durationMinutes === 1 ? "" : "s"} · {creditsLabel(booking.costUnits)}. These are real reserved credits. Both confirm after the scheduled end. Demo sessions do not publish ratings.</p>}
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm font-semibold text-muted">Teacher</dt><dd className="break-words">{name(booking.teacherId)}</dd></div>
        <div><dt className="text-sm font-semibold text-muted">Learner</dt><dd className="break-words">{name(booking.learnerId)}</dd></div>
        <div><dt className="text-sm font-semibold text-muted">Start · {current.timezone}</dt><dd>{formatSessionTime(booking.startsAt, current.timezone)}</dd></div>
        <div><dt className="text-sm font-semibold text-muted">End · {current.timezone}</dt><dd>{formatSessionTime(booking.endsAt, current.timezone)}</dd></div>
        <div><dt className="text-sm font-semibold text-muted">Duration</dt><dd>{booking.durationMinutes} minute{booking.durationMinutes === 1 ? "" : "s"}</dd></div>
        {booking.state === "pending" && <div><dt className="text-sm font-semibold text-muted">Request expires · {current.timezone}</dt><dd>{formatSessionTime(booking.requestExpiresAt, current.timezone)}</dd></div>}
      </dl>
      <p className="mt-5 font-semibold">Session value: {creditsLabel(booking.costUnits)} · Reservation: {booking.creditReservationStatus.replaceAll("_", " ")}</p>
      {funded && <p className="mt-3 text-sm leading-6 text-muted">Teacher confirmation: {booking.teacherConfirmed ? "recorded" : "pending"}. Learner confirmation: {booking.learnerConfirmed ? "recorded" : "pending"}. Credits remain held until both confirm after the scheduled end.</p>}
    </section>
    {meet && <GoogleMeetClient id={id} canEdit={meet.canEdit} initialUrl={meet.url}/>}
    {booking.dispute && <section className="mt-6 rounded-xl bg-warning p-5"><h2 className="text-xl font-semibold">Dispute</h2><p className="mt-3 break-words whitespace-pre-wrap">{booking.dispute.reason}</p><p className="mt-3">Teacher vote: {booking.dispute.teacherResolution ?? "not chosen"}. Learner vote: {booking.dispute.learnerResolution ?? "not chosen"}.</p>{!booking.dispute.resolvedAt && <p className="mt-3 font-semibold">Credits stay reserved indefinitely until both agree on a resolution.</p>}</section>}
    <BookingNotice legacy={booking.creditReservationStatus === "not_integrated"}/>
  </section>;
}
