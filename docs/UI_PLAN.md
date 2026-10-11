# UI plan

## Theme and session usability update

The current emerald/off-white identity is retained, with shared semantic colors supporting light, dark and device-following themes. Header controls persist preferences locally and synchronize tabs; first-paint theme initialization avoids a light flash. Narrow headers wrap safely, touch targets and focus outlines remain visible, and color transitions honor reduced motion.

Booking actions precede long details. The video workspace prioritizes the selected provider, local camera preview and embedded call; joining brings the frame into view. Scheduled-end refreshes reveal server-approved completion controls at the top of the call, preserving the running frame, with a waiting message after the viewer confirms. Meet launch links, post-session feedback, request reviews and admin confirmations are easier to reach. See [THEME_CALL_UX.md](THEME_CALL_UX.md) for behavior, verification and release limits.

Phase 3 implements `/`, `/signup`, `/login`, auth callbacks, `/onboarding`, `/dashboard`, and `/profile`. Phase 4 implements profile skill editing, `/discover`, and `/people/[id]`. Phase 5 implements `/people/[id]/request`, `/bookings` and `/bookings/[id]` as a scheduling preview. Phase 6 implements `/wallet`, funded request review and completion/dispute controls. Phase 7 implements the public Jitsi meeting demo screen. Community screens remain planned. One mobile-first visual system continues Phase 1's emerald, off-white, rounded-card palette. Use system fonts, readable contrast, semantic headings, visible keyboard focus, explicit labels, and touch targets of at least 44px.

## Navigation and screen map

Current navigation contains Dashboard, Profile, Discover, Bookings and Sign out; future sections are not dead links. The device timezone is selected explicitly with “Use my device timezone” during onboarding, otherwise UTC is the default. Desktop: compact header and primary navigation. Future mobile plan: a five-item navigation for Home, Discover, Bookings, Wallet, and Community; Profile available from the account menu. Navigation avoids covering page content and accounts for device safe areas. Meeting mode uses its own controls instead of the main navigation.

| Route | Screen and primary interaction | Important states |
| --- | --- | --- |
| `/` | Existing project landing; later sign-in entry | Clearly identifies unavailable features today |
| `/signup`, `/login` | Email/password forms; optional configured Google button | Validation, submitting, invalid credentials, email verification required, expired auth link |
| `/auth/callback` | Server identity redirect handler, no feature screen | Allowlisted redirect, provider error, return to login |
| `/onboarding` | Display name, short bio, college, timezone | Save progress; required-name error; successful redirect to dashboard |
| `/dashboard` | Implemented introduction and discovery link; later sessions/credits | New account guidance, no sessions, partial data failure |
| `/profile` | Edit own profile and offered/wanted catalogue selections | Independent save feedback, no selected skills, loading catalogue |
| `/discover` | People offering wanted skills; skill filter; each card says why matched | No wanted skills → profile link; no matches; loading; retry |
| `/people/[id]` | Implemented safe public profile, offered skills and scheduling request link; ratings deferred | Missing profile; own profile → edit; no private email/wallet |
| `/bookings` | Upcoming, incoming, history filters | No bookings, pending request deadline, local timezone, failures |
| `/people/[id]/request` | Implemented offered-skill/date/duration form and review | Explicit timezone, invalid/ambiguous time, overlap, retry, no-credit notice |
| `/bookings/[id]` | Implemented participants, skill, schedule, state and permitted actions | Expired request, stale action, terminal read-only; completion/disputes deferred |
| `/bookings/[id]/meeting` | Pre-join device check, public classroom-demo call, leave/rejoin | Unsupported device, denied permission, too early, cancelled booking, ended app window, disconnect/reconnect |
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

Check widths 360/390/768/1280px, no horizontal scroll, keyboard navigation and zoom, form errors, and empty/loading states. Complete Phase 9 on two physical smartphones over HTTPS, including camera/microphone permissions and recovery. The local Phase 3 Chromium test passed at 390×844 through signup, email verification, onboarding, editing, logout, and login; dashboard overflow was checked. Broader widths/accessibility/device testing and future screens remain unverified.

## Phase 4 evidence

Skill editing uses separate offered/wanted checkbox fieldsets, category labels and counts, max-20 selection guards, independent saving/error feedback and preserved choices on connection failure. Discovery has wanted-skill filtering, a reset action for invalid links, empty-state profile guidance, explained cards and next-page navigation. Member pages expose name/bio/college/enabled offered skills, redirect self to editing, and return 404 for missing IDs. They show no fake rating or booking action.

Chromium at 390×844 verified selection save/reload, discovery filtering, match explanation, safe member navigation and no horizontal overflow on discovery/member pages. Physical phones and hosted HTTPS remain unverified.

## Phase 5 scheduling evidence

Scheduling converts the saved IANA wall-clock time to UTC, rejects daylight-saving gaps/repeated times, reviews the exact start/teacher/skill/duration, and preserves details when returning to edit. All booking screens state that only time is reserved, with no credit reservation/transfer, video or completion. Request/action buttons retain idempotency keys across connection retries and refresh server state after mutations. Lists filter by role/state and page; detail shows the explicit viewer timezone and pending deadline. Teachers see accept/reject; participants see cancellation before start; server-derived actions hide ineligible controls.

Mobile Chromium at 390×844 verifies review/edit persistence, UTC storage/Kolkata display, a separate teacher browser using UTC, acceptance, cancellation, filtered participant list and no detail/list horizontal overflow. Unit checks cover fractional-offset zones, date rollover and US daylight-saving ambiguity/gaps. Physical smartphones/HTTPS remain unverified.

## Phase 6 mobile evidence

390×844 Chromium checks exercise the 3-credit wallet, real 0.5-credit reservation, separate participant confirmations, history and updated balances without horizontal overflow. Pending holds and disputed funds are explicitly explained. Completion controls depend on server-derived actions; dispute completion votes stay disabled before end. Successful actions refresh authoritative state, while failed network requests retain the same idempotency key for safe retry. Local timestamp fixtures advance the test clock boundary explicitly; physical-phone/video testing remains pending.

## Phase 7 classroom demo UI

The meeting page shows schedule/timezone, device check/stop controls, camera/microphone toggles, permission and connection errors, embedded Jitsi, leave/rejoin and a new-tab fallback for provider authentication. Public-room access limits and first-host sign-in are visible before joining. SkillSwap checks grants and polls booking eligibility; leaving transfers nothing. Timers end the app’s embedded view, not an independently opened public room. Live Jitsi media and physical phones remain separate manual validation.

## Phase 8 screens

Accepted booking pages let the teacher add/remove a Google Meet link. Meeting pages present Google Meet and Jitsi alternatives with external-link limits; Meet requires a fresh join-window check before exposing its new-tab link. Google handles devices and admission.

Completed settled bookings show a single rating/comment publication form, visibility/immutability notice, safe retry, pending/error/success feedback, and the persisted review after refresh. Member pages show received comments as escaped plain text with pagination and reviewer names. Own profile and discovery cards show average/count or “No ratings yet”. Community has responsive ranked cards, the ≥3-rating explanation, no-qualifiers state and bounded next-page links. Parent member loading/error boundaries apply; invalid page/query links offer a first-page reset. Credits and reputation remain separate.

## Product and responsive skills update

Public landing, metadata, onboarding and call screens present SkillSwap as a community product. The optional affiliation is labelled Organization. Public Jitsi's link-sharing and external access limits remain visible with product language.

Member navigation uses a compact native Menu below the desktop breakpoint, with active-page indicators, keyboard operation, Escape focus return, outside-click dismissal and close-on-navigation. Desktop keeps the full navigation. Shared input sizing, text wrapping, narrow-screen form stacks and full-width primary actions avoid squeezing forms or long names.

The skills form has name/category search, bounded scrolling lists, selected removable chips and an unsaved-choice notice. A separate custom-skill form supports a named skill, category including Other, and teaching/learning/both. Matching names reuse a shared catalogue identity; success asks the member to save the selected lists. Recoverable errors preserve entries and retries do not create duplicate names. Counts and database max-20 guards still apply.

Focused Chromium checks passed custom creation/save/reload, skill matching and booking, and the existing mobile signup/profile/selection journeys. All six main member screens fit 320/360/390/768/1280px widths; public home/login/signup also fit 320px. Screenshots were reviewed at narrow-phone and desktop sizes. Physical devices remain separate from browser viewport evidence.

The navigation follow-up labels the theme control visibly, gives every application hyperlink button styling, and adds booking/wallet/inbox dashboard shortcuts. Native link destinations and keyboard behavior remain intact. See [navigation checks and release prerequisites](NAVIGATION_FIXES.md).
