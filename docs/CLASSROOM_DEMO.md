# Two-person classroom demonstration

This is the manual checklist for the final hosted demo. Automated local browser checks are separate evidence; actual phones, public email delivery and live media have not been verified yet. Use only test identities and comments the two participants consent to publish. No extra credit grants, hidden accelerated clock, database edits or resets are part of the hosted demonstration.

## Prepare once

1. Complete the authorized [hosting setup](DEPLOYMENT.md), using the same stable HTTPS origin in Vercel and Supabase Auth. Run `npm run demo:check` and resolve configuration blockers. Verify the site's home/login pages load from both phones, without a localhost or development-machine address.
2. Use two real student email addresses and separate phone/browser sessions. Sign up, receive/confirm each email and sign in. Enter profile names, college/bio as desired and the correct IANA timezone (for example `Asia/Kolkata`). Record email delivery as passed only when both messages actually arrive and confirmation succeeds.
3. Teacher chooses **SQL** under **I can teach**; learner chooses **SQL** under **I want to learn**. Save selections. The learner finds the teacher through Discover and checks the matching explanation. Everyone can teach and learn; these are roles only for this booking.
4. Check both wallets. Each new verified, onboarded member receives 3 starter credits exactly once. Existing accounts may have different real balances; do not reset them or pretend they are new. The learner needs at least 0.5 available credits for a 30-minute booking.
5. Use Chrome on Android or Safari on iPhone, updated where possible. Allow microphone/camera access when asked. Use headphones or different rooms to avoid echo. Keep Google Meet/Jitsi sign-in available if the video provider requires it.

## Schedule and call

1. Learner opens the teacher's profile, selects **Request a session**, chooses SQL and **30 minutes**, and picks a start at least 15 minutes ahead. Review the timezone, duration and 0.5-credit reservation before sending. Teacher's time is displayed in the teacher's own timezone; it represents the same UTC instant.
2. Before the start, show pending state and the learner wallet: for a fresh account, 3 total, 0.5 reserved, 2.5 available. Teacher accepts. Show accepted state on both phones. No credits have transferred.
3. Teacher creates a real Google Meet meeting in Google's service and pastes the standard HTTPS meeting link into the booking, or both select the Jitsi demo. The teacher's Google Meet link is visible only to participants within SkillSwap. Jitsi uses a shared unpredictable room name and may require the first host to sign in.
4. Starting 10 minutes before the scheduled start, use **Prepare for demo call**. With Google Meet, choose **Prepare Google Meet** then open the new-tab link; Google supplies admission/device checks. With Jitsi, use **Check devices**, join and use camera/microphone controls. Public provider links can be usable outside SkillSwap if copied; do not describe these demo calls as private provider-enforced rooms.
5. Confirm both participants can hear and see one another. Test mute/unmute, camera off/on and leaving/rejoining. Briefly disconnect/reconnect one phone if appropriate and confirm recovery. Record phone/browser, provider and observed issues. Returning to SkillSwap must not transfer credits merely because the call ended.

## Complete and review

1. Wait until the real scheduled end. A new 30-minute booking requires at least 15 minutes of advance scheduling plus its actual 30-minute duration; prepare it before the presentation. A short classroom presentation can show live joining and later show a previously, legitimately completed session for completion/history/feedback. Explain that these are different bookings. Do not silently edit timing or claim a short call earned a full lesson.
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
