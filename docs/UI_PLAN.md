# UI plan

Design only; all routes below except `/` are unimplemented. One mobile-first visual system continues Phase 1's emerald, off-white, rounded-card palette. Use system fonts, readable contrast, semantic headings, visible keyboard focus, explicit labels, and touch targets of at least 44px.

## Navigation and screen map

Desktop: compact header and primary navigation. Mobile: a five-item navigation for Home, Discover, Bookings, Wallet, and Community; Profile available from the account menu. Navigation avoids covering page content and accounts for device safe areas. Meeting mode uses its own controls instead of the main navigation.

| Route | Screen and primary interaction | Important states |
| --- | --- | --- |
| `/` | Existing project landing; later sign-in entry | Clearly identifies unavailable features today |
| `/signup`, `/login` | Email/password forms; optional configured Google button | Validation, submitting, invalid credentials, email verification required, expired auth link |
| `/auth/callback` | Server identity redirect handler, no feature screen | Allowlisted redirect, provider error, return to login |
| `/onboarding` | Display name, short bio, college, timezone | Save progress; required-name error; successful redirect to dashboard |
| `/dashboard` | Next session, incoming requests, wanted skills, available/reserved credits | New account guidance, no sessions, partial data failure |
| `/profile` | Edit own profile and offered/wanted catalogue selections | Independent save feedback, no selected skills, loading catalogue |
| `/discover` | People offering wanted skills; skill filter; each card says why matched | No wanted skills → profile link; no matches; loading; retry |
| `/people/[id]` | Safe public profile, offered skills, reputation and request action | Missing profile; own profile → edit; no private email/wallet |
| `/bookings` | Upcoming, incoming, history filters | No bookings, pending request deadline, local timezone, failures |
| `/bookings/[id]` | Participants, skill, schedule, cost, state; permitted actions only | State changed elsewhere; first completion awaiting other; disputed funds held; terminal read-only |
| `/bookings/[id]/meeting` | Pre-join device check, private call, leave/rejoin | Unsupported device, denied permission, too early, cancelled booking, expired token, disconnect/reconnect |
| `/wallet` | Total, reserved, available; auditable history | No transactions, funds held in dispute, insufficient available credits |
| `/community` | Leaderboard with score and count | No qualifying members, loading, error |

## Detailed interactions

Request flow: choose one of the member's offered skills → select future date/time with explicit timezone → choose 30/60/90 minutes → review teacher, learner, start/end, cost and reservation notice → submit once. Disable while submitting; preserve form values on recoverable errors. `409 SCHEDULE_CONFLICT` refreshes availability, `409 INSUFFICIENT_CREDITS` links to wallet. Never compute authoritative availability/balances in the browser.

Bookings: teacher sees accept/reject while pending; learner sees cancel; both can cancel accepted sessions before start. Confirmation appears after scheduled end with an explicit statement that both confirmations transfer the listed credit amount. Dispute requires a reason; show independent complete/cancel resolution votes and the reserved amount. Re-fetch state after every mutation; conflicting updates show the latest state without pretending the action succeeded.

Wallet: display 60 units as 1 credit, 30 as 0.5; always format from integer units. A reservation changes available credits without changing settled total. Separate holds from signed ledger history and link entries to participant-accessible booking detail. Reputation never appears as spendable money.

Feedback: only completed-session participants see the form. Show target identity, 1–5 accessible radio buttons, optional 500-character plain-text comment, and a submit-once notice. Never show an anonymous rating as a completed financial event.

Meeting: request device permission after user intent, show camera preview and device choices before join. Provide labeled mute, camera, and leave controls; reconnect clearly. A visible note states that leaving a call does not complete the session or transfer credits. No screenshot/mock call is a live verification substitute.

## Shared behavior

- Loading: skeleton/text status and `aria-busy`; prevent duplicate submissions.
- Empty: explain why and link to one useful next action.
- Error: plain explanation, field associations where applicable, retry for recoverable reads; never show internal stack traces or secrets.
- Success: visible saved/submitted message using an appropriate live region; move focus only when needed.
- Authentication: preserve only safe internal return paths; expired login returns to sign-in. Incomplete profiles lead to onboarding.
- Dates: explicit local timezone, readable start/end; store/submit UTC. Test timezones and daylight-saving edges before scheduling is claimed ready.
- Pagination: a labeled load-more action; stable ordering; explain when no further results exist.

## Later validation

Check widths 360/390/768/1280px, no horizontal scroll, keyboard navigation and zoom, form errors, and empty/loading states. Complete Phase 9 on two physical smartphones over HTTPS, including camera/microphone permissions and recovery. These checks have not been performed on the planned screens.
