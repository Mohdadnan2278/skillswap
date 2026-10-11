# SkillSwap MVP specification

## Status and scope

This is the living MVP specification. Phase 3 implements authentication, onboarding/profile editing, protected navigation and logout; auth/profile APIs and the two profile tables are verified locally. Phase 4 implements the shared catalogue, offered/wanted selection, deterministic discovery and public member profiles. Phase 5 adds locally verified scheduling requests, accept/reject/cancel, scoped expiry and private booking views. Phase 6 implements credit reservations, wallet and mutual settlement. Phase 7 implements the explicitly public Jitsi classroom demo described below; Phase 8 adds feedback and community reputation. The owner delegated selection of appropriate rules for better interaction and user experience during Phase 2. The MVP defaults below were chosen under that authorization; they were not individually confirmed word for word. Changes affecting these rules must be recorded before dependent implementation.

Confirmed by the owner's project prompt: one Next.js application with TypeScript, Tailwind, Supabase PostgreSQL/Auth, and a managed video provider selected in Phase 7. Use npm, versioned migrations, and a responsive browser experience. Prefer Vercel, with deployment only after explicit authorization. Everyone may teach and learn; teacher and learner are roles within a booking, never permanent account roles.

The demonstration must eventually support two real accounts on two smartphones over HTTPS through signup → skills → discovery → request → accept → video → completion → credit transfer → feedback. No simulated balances, fake meetings, or accelerated hour-long sessions may be presented as verified behavior.

## Admin and Google login extension (owner-authorized 2026-10-11)

Google sign-in stays visible with an explicit unavailable state until the actual provider is configured. Google-only sign-in can avoid custom SMTP, but requires a Google OAuth web client in Supabase; a button is not proof of a working external login.

Admins are explicitly provisioned verified/onboarded accounts in a private database membership table, never client metadata or the first signup. The owner requested a demo administrator with a reserved nonexistent test address; only that account may be confirmed through the trusted provisioning API without an email delivery claim. Its random password stays in an ignored private file. Ordinary signup confirmation remains required.

The panel manages member suspension/restoration, admin membership (without removing the last administrator), catalogue creation/enabling, feedback hiding/restoration, dispute review notes, and reads booking/wallet summaries. All writes require a reason, server-derived admin identity, idempotency and an immutable audit record. Suspension blocks member API/database operations and hides discovery profiles, while preserving balances and existing bookings. Restore suspended participants to let them complete existing exchanges. Moderation hides a review from public reputation without editing/deleting it. Dispute review records staff action; it never overrides participant votes or moves credits. There is no arbitrary balance editing, hard account deletion, rating manipulation or access to meeting links/provider secrets.

## MVP capabilities and boundaries

| Phase | Deliverable | Completion evidence |
| --- | --- | --- |
| 3 | Email/password signup/login/logout, onboarding, profile editing, authenticated navigation | Two configured accounts; valid server identity; ownership and unauthenticated access checks |
| 4 | Shared catalogue, offered/wanted selections, deterministic discovery | Matches explain shared wanted/offered skills; current user excluded; cross-user edits denied |
| 5 | Request/accept/reject/cancel and participant-only views | Valid transitions; concurrency-safe overlap checks across both roles; UTC/local-time behavior |
| 6 | Starter grant, wallet, reservations, ledger, completion and releases | Replays and concurrent spending cannot duplicate grants/transfers or create negative available balances |
| 7 | Public Jitsi demo and optional teacher-added Google Meet link | App membership/window checks; external-provider limits disclosed; real phone checks pending |
| 8 | Feedback and reputation leaderboard | Completed-session eligibility; one review per participant; server aggregate |
| 9 | Complete integration and authorized hosting | Reproducible two-person demo and permission/error/mobile checks |

Optional: Google OAuth if provider configuration is available. Deferred: payments, buying credits, AI matching, native apps, custom video infrastructure, chat, recurring/group sessions, penalties, and administrator dispute tooling. Do not add unrelated infrastructure.

## Adopted MVP defaults — chosen under owner delegation

Decision record: after being offered the core defaults, the owner instructed the assistant to choose appropriately for better user interaction and experience. The assistant adopted the rules below for this semester MVP. This approves the design direction, not implementation beyond the currently authorized phase, remote database changes, or paid services.

| Rule | Adopted default |
| --- | --- |
| Starter grant | Once per verified account after profile onboarding: 3 credits (180 integer minute units). Demo accounts do not receive extra silent grants. |
| Exact amounts | 1 credit = 60 integer minute units. Never store floating-point balances. 30/60/90-minute sessions cost 30/60/90 units (0.5/1/1.5 credits). |
| Booking window | Start must be at least 15 minutes and at most 30 days ahead, checked against database time; sessions are fixed-duration and not editable. Cancel and request anew to reschedule. |
| Participants | Requester is learner, recipient is teacher. Different verified/onboarded accounts; teacher must currently offer the selected catalogue skill. |
| Reservation | Reserve the full cost when the request is created, atomically with booking and participant occupancy. A pending request holds time and credits for both people. |
| Expiry | Pending requests expire at the earlier of creation + 24 hours or scheduled start. Expiry releases credits and occupancy exactly once. Reads and mutations process relevant overdue requests; an optional scheduled sweep improves prompt cleanup. |
| Acceptance | Only teacher may accept/reject a pending, unexpired request before its start. Recheck locked participant occupancy, active reservation, and valid state. |
| Cancellation | Either participant may cancel pending/accepted bookings before start, with no fee; reservation released exactly once. After start, use dispute or completion. |
| Completion | Each participant independently confirms after scheduled end. First confirmation retains the reservation. Both confirmations atomically complete and transfer the reserved units from learner to teacher. Ending a call transfers nothing. |
| Missing confirmation | After scheduled end, show accepted sessions as awaiting confirmation; do not auto-transfer, auto-confirm, or auto-release money. Either participant may raise a dispute. |
| Dispute | Either participant may dispute an accepted session after start, including after one confirmation. Credits remain held. Both must vote for the same resolution: complete after scheduled end, or cancel/release at any time while disputed. No unilateral resolution and no MVP admin override. A changed vote replaces the prior vote until resolved. |
| Unresolved dispute | Remains visible with funds reserved indefinitely; no automatic timeout or penalty. This limitation must be visible in the wallet and booking UI. |
| Reputation | Each completed booking permits each participant to leave one immutable 1–5 integer star rating of the other, with optional plain-text comment up to 500 characters. Server computes arithmetic average and rating count, separate from credits. |
| Leaderboard | Users with at least 3 received ratings; average descending, then count descending, then user ID for stable ties. Display score and count; no artificial starting rating. |
| Classroom time | Use real scheduled duration. A shorter accelerated demonstration needs a separately approved, visibly labeled demo mode; it cannot silently earn an hour's credit. |

These defaults prioritize understandable costs, reversible requests, and protection from one-sided credit transfers. A pending request visibly reserves both time and credits; its deadline is shown before submission and on booking detail. Starter credits are a one-time demo/community issuance, not currency. No further product-rule answer blocks Phase 3; each implementation phase still needs the owner's instruction to start. Any future fee, automatic dispute settlement, starter amount change, or accelerated-credit demonstration requires a new recorded decision.

## Booking lifecycle

Stored states: `pending`, `accepted`, `rejected`, `cancelled`, `expired`, `completed`, `disputed`. Awaiting confirmation is a UI view of an accepted booking after its end, not a second database state. End timestamps are derived from start + duration. Intervals are half-open `[start, end)` so back-to-back sessions are allowed.

| From | Action / actor | To | Funds |
| --- | --- | --- | --- |
| New | Request / learner | pending | Reserve |
| pending | Accept / teacher before expiry/start | accepted | Keep held |
| pending | Reject / teacher | rejected | Release |
| pending | Deadline passed / trusted expiry operation | expired | Release |
| pending or accepted | Cancel / either before start | cancelled | Release |
| accepted | Confirm / either after end | accepted until both confirm, then completed | Transfer once on second confirmation |
| accepted | Dispute / either after start | disputed | Keep held |
| disputed | Both choose complete after end | completed | Transfer once |
| disputed | Both choose cancel | cancelled | Release once |

Terminal states never reopen. Conflicts cover both participants in pending/accepted/disputed bookings' scheduled intervals. Overdue pending holds must be expired in the same transaction before a new operation assesses conflicts or available funds. A future dispute does not extend the original occupied interval indefinitely. Concurrent transactions lock both participants in sorted UUID order and use database exclusion constraints; application-only checks are insufficient.

## Identity, privacy, and correctness

- Validate identity on the server with current Supabase SSR guidance in Phase 3; never authorize from unverified cookie/session payloads. Require verified email and completed onboarding for booking operations.
- Keep a safe public profile projection separate from private account preferences/email. Supabase Auth owns passwords and email identities.
- RLS applies to every exposed application table. Profiles/skills are readable by authenticated members; owner edits only. Bookings, confirmations, disputes, wallet and meeting access are participant/owner only.
- Financial/scheduling mutations use restricted atomic database functions with explicit actor checks, fixed search paths, least privilege, and database-enforced invariants. Browsers cannot directly edit balances, booking state, occupancy, ledger, confirmations, or meeting credentials.
- Same-origin mutation endpoints reject foreign origins; handle OAuth redirects separately with an allowlist. Add input/body limits, pagination, and reasonable authentication/meeting rate limits. No secrets or private responses in logs/caches.
- Store instants as PostgreSQL `timestamptz` in UTC; accept ISO 8601 UTC values, display in the browser's chosen IANA timezone and always show the timezone on scheduling screens. Reject past times and ambiguous local times before submitting.
- Provider secrets remain server-only; membership and time windows are rechecked for every short-lived video token. Tokens are not long-lived join URLs in the database.
- Deleting an account with outstanding reservations/bookings is outside MVP scope; do not cascade away financial audit history.

## Phase boundaries and pending external setup

Phase 2 design is complete. Phase 3 has real local Supabase two-account and mobile Chromium evidence; hosted Supabase, Google OAuth, production SMTP, physical phones and fresh-task restoration remain unverified. The owner has authorized hosted Supabase creation/configuration followed by Phase 4; account access is still missing. The owner subsequently instructed an access recheck and continuation to Phase 4; Phase 4 is implemented and verified locally while hosted setup remains blocked. Business defaults were selected under owner delegation. Deployment and paid resources require separate authorization.

## Phase 5 interim scheduling boundary

The owner authorized continuation locally while hosted setup is pending. Consistent with the original phase plan, Phase 5 is a visibly labeled scheduling preview. It reserves time and enforces participant transitions/expiry, but has no wallet, starter grant, monetary reservation, ledger, confirmation or transfer. Each booking carries `creditReservationStatus: "not_integrated"`; the stored duration-derived `costUnits` is a future valuation, never a balance or held amount. No funded exchange or financial demo is claimed.

The final MVP credit rules remain unchanged. Phase 6 must integrate request-time reservations and releases atomically before reporting funded booking readiness. Existing preview bookings must remain visibly unfunded and ineligible for settlement; do not retroactively charge or transfer for them. Future funded sessions require a new properly reserved request. No private video or feedback endpoint is implemented in Phase 5.

## Phase 7 demo scope decision

The owner requested an open-source/free video option and clarified that this is a classroom demo with no video server. Use public Jitsi Meet explicitly as `jitsi_demo`, with no video-provider API key or private server. SkillSwap still checks verified onboarding, participants, accepted funding, the join window and bounded grants. Rooms have unguessable database-generated names. Public Jitsi cannot enforce participant-only authorization outside SkillSwap, revoke a leaked room link, or forcibly end provider sessions when the app window closes. The app must state these limits and must not describe public rooms as private or claim short-lived provider tokens. The first participant may need to authenticate with Jitsi to start the room. Full private-video enforcement is deferred until private hosting is authorized/configured. Financial rules and real classroom duration remain unchanged.

## Google Meet and Phase 8 decisions

The owner requested both public Jitsi and Google Meet. Keep Jitsi available; a teacher may add, replace or remove a canonical `https://meet.google.com/xxx-xxxx-xxx` link for an accepted funded booking. Only participants can read it; opening through SkillSwap requires the same join window. Google controls admission and device checks in its new tab. No embedding, Google OAuth integration, automatic meeting creation, key or server is required. Links copied outside the app cannot be revoked by SkillSwap. Calls never change financial completion. Applied historical migrations remain immutable even when they describe retired providers; no active Daily integration or key is needed.

Phase 8 uses the adopted one immutable review per completed settled booking participant, 1–5 integer stars and optional plain-text comment of at most 500 characters. The server derives the other participant. Ratings, reviewer identity and comments are published to signed-in members; the UI explains this before submission. Booking details and meeting links stay participant-only. Reputation has no financial effect. The leaderboard requires at least three received ratings and sorts by exact average descending, count descending, then UUID ascending. A retry with the same idempotency key/input returns the original review; a new key cannot create a second review.

## Phase 9 verification scope

The owner authorized Phase 9 integration and classroom demo preparation. Verify the connected two-account flow, configuration, permissions and mobile UX; prepare Vercel configuration and a reproducible checklist. Deployment remains subject to the previously stated separate authorization. Do not provision paid resources, migrate local synthetic users to hosted Supabase, bypass email confirmation or introduce financial demo acceleration. Automated local fixtures must stay distinct from real media, hosted email and physical-phone evidence. A short presentation may show a live call and a separately, legitimately completed booking, with that distinction stated clearly.
