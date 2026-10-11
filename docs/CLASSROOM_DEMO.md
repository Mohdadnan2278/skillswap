# Two-person session validation

This is the manual checklist for the final hosted demo. Automated local browser checks are separate evidence; actual phones, public email delivery and live media have not been verified yet. Use only test identities and comments the two participants consent to publish. No extra credit grants, hidden accelerated clock, database edits or resets are part of the hosted demonstration. The owner-authorized Demo session mode openly uses an admin-selected short duration and real credit cost.

## Prepare once

1. Complete the authorized [hosting setup](DEPLOYMENT.md), using the same stable HTTPS origin in Vercel and Supabase Auth. Run `npm run demo:check` and resolve configuration blockers. Verify the site's home/login pages load from both phones, without a localhost or development-machine address.
2. Use two real accounts and separate phone/browser sessions. Google sign-in is configured and can be used for onboarding. For email/password signup, receive and confirm each email; record delivery only when both messages arrive. Enter profile names, organization/bio as desired and the correct IANA timezone (for example `Asia/Kolkata`).
3. Teacher chooses **SQL** under **I can teach**; learner chooses **SQL** under **I want to learn**. Save selections. The learner finds the teacher through Discover and checks the matching explanation. Everyone can teach and learn; these are roles only for this booking.
4. Check both wallets. Each new verified, onboarded member receives 3 starter credits exactly once. Existing accounts may have different real balances; do not reset them or pretend they are new. The learner needs at least 0.5 available credits for a 30-minute booking.
5. Use Chrome on Android or Safari on iPhone, updated where possible. Allow microphone/camera access when asked. Use headphones or different rooms to avoid echo. Keep Google Meet/Jitsi sign-in available if the video provider requires it.

## Fast live credit-transfer demonstration

1. Sign in as an administrator and open **Admin → Demo**. Enable demo sessions, choose **1 minute** and **0.5 credits**, review and save with a reason. The setting starts disabled and applies only to new explicitly selected demo requests. Administrators may choose 1–10 minutes and 0.5–3 credits; the learner must have sufficient available funds.
2. Learner requests the teacher's offered skill and chooses **Demo session**. Review the short duration and exact credit amount, then send. Teacher accepts **within one minute**; both can immediately prepare Jitsi or a teacher-saved Google Meet call. The formal start is request + one minute; end is start + the selected actual duration.
3. Keep the booking open to show its server-based countdown. For the recommended settings, completion becomes available roughly **two minutes after requesting**. Booking actions refresh automatically every five seconds, including the learner's acceptance status and completion buttons.
4. Learner confirms completion after the end: the credits stay reserved. Teacher independently confirms: exactly **0.5 credits** transfer once. For two fresh accounts, learner ends with 2.5 credits and teacher with 3.5, with no reservation left. Show both wallets/histories and the completed booking.
5. This is a labelled demo exchange using real wallet credits. Its short time is independent of the selected credit cost; it does not publish ratings or inflate community reputation. Turn off demo sessions in Admin after presenting. Disabling/changing settings leaves existing booking terms and settlement intact.

The countdown is scheduled time, including while Meet is in another tab; neither provider's actual attendance is measured. Both people must confirm. Missing the acceptance deadline releases the hold; cancellation before start or rejection also releases it. After start use the existing mutual dispute resolution if a session should not complete.

## Standard schedule and call

1. Learner opens the teacher's profile, selects **Request a session**, chooses SQL, **Start now** and **30 minutes**. No date entry is needed. Review the immediate-call option and 0.5-credit reservation, then send. Alternatively choose **Schedule for later** and a start at least 15 minutes ahead.
2. Show pending state and the learner wallet: for a fresh account, 3 total, 0.5 reserved, 2.5 available. Teacher opens Bookings, finds the incoming request and accepts **within 5 minutes**. Reload the learner's booking and show accepted state on both phones. No credits have transferred. The formal quick-call start is creation + 5 minutes; calls already open after acceptance. A missed deadline expires/releases the request; send a new request.
3. Teacher uses **Create a Google Meet meeting**, copies the meeting-code link from Google and saves it on the booking. Copied sharing parameters are removed automatically; the success message confirms persistence. A Google landing/creation-page URL is not a meeting-code link. The learner's screen updates within five seconds, or immediately through **Refresh Meet link**, then **Prepare Google Meet** becomes available. Alternatively use Jitsi; its first host may need to sign in, so do that before presenting. Provider sign-in is separate from SkillSwap login.
4. Use **Prepare for call** immediately after acceptance for **Start now**; future scheduled calls open 10 minutes before start. With Google Meet, choose **Prepare Google Meet** then open the new-tab link; Google supplies admission/device checks. With Jitsi, use **Check devices**, join and use camera/microphone controls. Public provider links can be usable outside SkillSwap if copied; do not describe them as provider-enforced private rooms.
5. Confirm both participants can hear and see one another. Test mute/unmute, camera off/on and leaving/rejoining. Briefly disconnect/reconnect one phone if appropriate and confirm recovery. Record phone/browser, provider and observed issues. Returning to SkillSwap must not transfer credits merely because the call ended.

The **Session schedule** countdown uses the booking's server-derived start/end for both providers. It shows time until the formal start, then scheduled time remaining; returning from Meet or reloading does not restart it. This link-based integration does not record actual Meet attendance or call duration. Completion eligibility stays tied to the scheduled end and both participants' independent confirmation.

## Complete and review

1. Wait until the real scheduled end. **Start now** allows immediate call access, but a 30-minute booking still ends 35 minutes after creation (5-minute acceptance allowance + actual 30-minute duration). For a short credit-transfer presentation, use the explicit admin-enabled Demo session flow above. Public feedback still requires a full standard session. Either participant can cancel before the formal start to release a quick-call reservation. After start, use the normal dispute/completion rules. Do not edit timing or claim a short call earned a full lesson.
2. Learner confirms completion. The learner's 0.5 credit stays reserved and the teacher has received nothing yet. Teacher independently confirms after the end. The booking becomes completed and exactly 0.5 credit transfers once.
3. With fresh accounts and no other activity: learner shows 2.5 total/available and 0 reserved; teacher shows 3.5 total/available. Both histories show the corresponding debit/credit. Reload and verify persistence; repeated confirmation must not transfer again.
4. Each participant may publish one 1–5 star review of the other with an optional plain-text comment. Explain that names, ratings and comments are visible to signed-in members and cannot be edited/deleted in this MVP. Reload to verify the published review and the other member's average/count.
5. Open Community. Members need at least **3 received reviews** to qualify; a single exchange creates one received review per person and should not place either on the leaderboard. If needed, show an honestly populated member with three completed-session reviews; do not seed fake reputation or extra credits.
6. Sign the learner out and verify protected booking/wallet screens redirect to login. The teacher's independent session should stay signed in.

## Permission and recovery checks

- A third signed-in, onboarded account cannot open this booking or retrieve either provider's access through SkillSwap. A leaked external public-provider link has different limits and is not revoked by the app.
- Learner cannot accept their own request or change the teacher's Meet link. Before the join window, Jitsi joining is unavailable and Meet preparation through the access endpoint is denied.
- On a separate future booking, rejection, pre-start cancellation or pending expiry releases the reservation once. Pending expiry may be processed by the next relevant request/read; this MVP has no background sweep requirement.
- Confirmation before the end and feedback before mutual completion are denied. If a session has a real problem after start, use **Open dispute**. Credits stay held until both agree; there is no automatic expiry, fee or administrator override. Use a separate test booking if demonstrating this.
- Denied camera/microphone permission should give a useful message. Retry after changing browser permissions or use the provider's new-tab flow. If the app reports an uncertain network result, reload/review the booking or wallet before repeating a different action; identical retries are protected by idempotency.

## Evidence record

Copy this table into an ignored local note, or a report containing no keys/passwords/private links. Fill observations after actual testing; do not mark pending items as passed from automated browser results.

| Check | Current status | Actual observation/date |
| --- | --- | --- |
| Authorized HTTPS deployment and exact Auth callbacks | Verified | 2026-10-10: https://skillswap-delta-taupe.vercel.app; live public pages 200, protected pages redirect, anonymous APIs 401 and foreign-origin mutation 403 |
| Two real signup/confirmation/login flows | Pending | |
| Phone A OS/browser and phone B OS/browser | Pending | |
| Google Meet: join/audio/video/devices/rejoin | Pending | |
| Jitsi: join/audio/video/devices/rejoin (if demonstrating it) | Pending | |
| Timezone agreement, booking and reservation | Verified locally; hosted pending | |
| Real-duration mutual completion and single transfer | Verified locally with timing fixtures; hosted pending | |
| Feedback persistence and real average/count | Verified locally; hosted pending | |
| Unauthorized booking/access and logout separation | Verified locally; hosted pending | |

Phase 9's local checks and authorized HTTPS deployment are verified. The final live-demo goal remains open until actual email delivery, the chosen provider's two-phone call and real-duration hosted completion are observed.
