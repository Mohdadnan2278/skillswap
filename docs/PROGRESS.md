# Progress

## Phase 1 — Foundation

Implemented Next.js App Router, TypeScript, Tailwind CSS, npm scripts and lockfile, a responsive landing page, and frontend/backend/shared directories. Updated ownership and conventions. The original prompt is kept only in ignored `.local/PROJECT_PROMPT.txt`.

Verified: frozen-lockfile `npm ci`, ESLint, TypeScript, and production build; production and development homepage requests returned HTTP 200 with the expected heading, and an unknown production route returned HTTP 404. Headless Chromium stalled in this cloud machine, so browser visual/mobile checks remain unverified. ESLint 9.39.5 is pinned for the current Next.js plugin peer ranges; npm marks it deprecated, so revisit when those plugins support ESLint 10. No application feature modules or external services are configured.

## Phase 2 — Specification and UI plan

Created `PROJECT_SPEC.md`, `docs/API_CONTRACT.md`, `docs/DATABASE_SCHEMA.md`, `docs/UI_PLAN.md`, and provider-neutral shared TypeScript design DTOs. Updated README and collaboration guidance. No feature routes, database migrations, credentials, or dependencies were added.

Business decision: the owner delegated choosing appropriate rules for user interaction/experience after being shown the core defaults. Adopted 3 starter credits, 30/60/90-minute durations, exact integer minute units, request-time reservations, no cancellation fees, two-party completion, held disputes with mutual resolution, and completed-session-only feedback. Full timing, expiry, privacy, and reputation rules are recorded in the specification. These decisions were selected under delegation, not individually confirmed verbatim.

Validation: `npm run check` passed ESLint, route type generation, TypeScript checking (including shared DTOs), and the production build. `git diff --check` passed. Database, authentication, business API, and planned screen behavior remain unimplemented and untested.

## Phase 3 — Authentication and profiles

Implemented Supabase SSR email/password signup/login/logout, email confirmation and resend, optional configured Google OAuth entry point/callback, onboarding/profile editing, protected dashboard/navigation, strict input validation, and owner-only profile endpoints. Added the atomic `save_my_profile` migration with RLS/least-privilege grants and private timezone preferences. Added server-only boundaries, authoritative `getUser()` guards, `getClaims()` cookie refresh, cache/CSRF protection, and safe redirects.

Prepared real local Supabase with official GHCR slim images, a readable confirmation template, local Docker proxy/health-check corrections, and reusable local environment helpers. No remote project, database, OAuth provider, or host was changed. Shared dependency additions were made within the owner's authorized Phase 3 scope and are recorded in package.json/lockfile.

Verified: 19 unit tests; 3 local Playwright integration/browser tests. Two real accounts exercised confirmation, persistence, owner/injected-field checks, direct Data API mutation denial, private preference RLS, invalid RPC rollback, logout and independent sessions. Chromium at 390×844 exercised the signup→confirm→onboard→edit→reload→logout→login flow and dashboard overflow. Lint, route type generation, TypeScript and production build passed. Production smoke checks passed: homepage/login 200, anonymous current-user API 401, protected profile redirects to login, unknown route 404. Re-running local database startup succeeded without resetting data. Frozen-lockfile installation passed.

External checks still unrun: hosted Supabase/migrations, Google OAuth, real SMTP delivery, physical smartphones over HTTPS, and fresh-task restoration. Setup instructions are in `docs/SUPABASE_SETUP.md`. Reputation fields remain null/zero because Phase 8 is not implemented; no credits are granted yet.

## Phase 4 — Skills and matching

The owner instructed an access recheck and continuation. Hosted access remains missing: no injected token, saved requirement has no binding, and CLI project listing returns missing access token. No hosted project or paid resource was created. Phase 4 was implemented against real local Supabase under that continuation instruction.

Implemented the 12-entry migration-controlled catalogue, strict offered/wanted selections with max 20 unique enabled IDs per direction, atomic verified/onboarded owner replacement, concurrent-save serialization, and deterministic wanted-to-offered discovery. Self is excluded; each match explains the shared skills. Catalogue/discovery use bounded validated pagination, user/filter-scoped discovery cursors and strict query inputs. Added profile checkboxes, filtering, empty/error states, safe member pages and navigation.

Verified: 19 unit tests and all 5 local integration/browser tests passed, including earlier Phase 3 regression checks. Phase 4 checks exercised cross-user/direct-write denial, injected fields, unknown/duplicate/over-limit atomic rollback, concurrent whole-set replacement, self exclusion, explanations, stable pagination, cursor-context rejection and clearing selections. Mobile Chromium at 390×844 verified save/reload/filter/member profile/404 and no discovery/member-page overflow. Final lint, type generation, TypeScript and production build passed. Production smoke checks verified homepage 200, all three new anonymous API reads 401, discovery/member redirects to login, and unknown route 404. Reapplying migrations applied zero files and preserved data. Tests use account IDs rather than nonunique names and clear only their own selections for repeatability.

The prompt remains Git-ignored. Hosted setup, Google OAuth, production SMTP, physical phones and fresh-task restoration remain unverified.

## Phase 5 — Scheduling and bookings

The owner authorized local continuation while catching up on hosted Supabase setup. Their credential file is on their computer and absent from this cloud workspace; no hosted resource or database was changed. Added an explicit Git ignore for `supabase/supabase.env`.

Implemented time-only scheduling preview requests, accept/reject/cancel, participant list/detail, scoped expiry, duration/time/offering checks, UTC storage, saved-timezone display, daylight-saving ambiguity rejection and responsive review/action screens. Restricted atomic database functions derive verified/onboarded actors. UUID-ordered participant locks, a global MVP scheduling advisory lock and two-row GiST occupancy prevent concurrent/both-role conflicts. Private durable idempotency makes successful retries safe. JSON conflicts preserve committed expiry cleanup.

Credit boundary: all bookings are explicitly `not_integrated`; only time is reserved. No starter grant, wallet, credit reservation, settlement, confirmation, dispute, video or feedback exists. UI/API/docs state this. Phase 6 must never silently fund or settle historical preview bookings; new funded requests are needed.

Verified: 22 unit tests and all 8 local integration/browser regression tests passed. Booking coverage includes actor/RLS/role checks, replay/conflicting keys, time/duration/input rules, both-role and concurrent overlaps, adjacent intervals, terminal release, offering changes, exact 24-hour expiry, persisted expired actions and started-session cancellation denial. Mobile review/edit/submit, Kolkata-vs-UTC participant displays, accept/cancel/list filters and overflow checks passed. Final lint, type generation, TypeScript and production build passed. Production anonymous booking reads returned 401, protected screens redirected to login, homepage returned 200 and unknown route 404. Reapplying migrations made no changes. Direct privilege checks confirmed anonymous booking read/RPC denial and member direct-write/private-expiry denial.

## Phase 6 — Credits and completion

Implemented one-time 3-credit issuance for verified onboarding (including eligible existing members), private wallet/history and active reservations, atomic funded booking creation/releases, append-only balanced ledger pairs, exact bigint boundaries, two-party after-end completion and mutual dispute votes. New requests reserve the session cost; rejection, cancellation before start and pending expiry release it. A single confirmation transfers nothing. Both participants must agree to complete or cancel a dispute, and disagreeing votes retain funds indefinitely. Historical preview bookings remain unfunded and cannot settle. No extra demo credits are minted.

Added responsive wallet and completion/dispute controls, credit-aware request review and actionable insufficient-credit messages. Server input/actor/amount guards, RLS, durable idempotency, unique financial events and deferred wallet/reservation/ledger reconciliation protect transactions. Shared schema/DTOs, runtime validators and the integration script were updated without adding dependencies. Database migration is applied only locally; hosted credentials are still absent.

Verified: 24 unit tests and all 11 real-local integration/mobile tests passed, including earlier phase regressions. Coverage includes one-time issuance, concurrent spending, exact refunds and expiry, owner RLS/direct-write denial, immutable ledger and deferred reconciliation, duplicate final confirmations, single transfer, after-end guards, changed/mismatched dispute votes, mutual cancellation, scoped history/hold pagination and legacy funding rejection. Mobile wallets show real reservations and separate participant completion with correct balances and no overflow. Lint, route types, TypeScript, production build and anonymous production wallet/redirect smoke checks passed. Reapplying migrations made no changes. Final migration sources also applied successfully to a temporary empty PostgreSQL database with minimal Auth/schema stubs; this checks migration ordering and SQL, while the integration suite checks real Supabase Auth. The temporary database was removed. Local timing fixtures advance deadlines/end times explicitly; they do not represent real elapsed sessions, physical-phone testing or a completed video demo. Funds use actual PostgreSQL transactions and normal starter grants.

## Phase 7 — Public Jitsi classroom demo and hosted transition

The owner authorized the next phase and local-to-hosted changes, then chose an open-source/free video option and clarified that there is no private video server and this is a classroom demo. Implemented `jitsi_demo` rather than claiming private public-room enforcement. No video API key, paid resource or video server is provisioned. This scope decision is recorded in PROJECT_SPEC.md.

Supabase access is now valid. Created free-plan SkillSwap project `avunxagyeywvfjhhowqk` in Mumbai and applied all seven migration files with transactionally recorded history. The pre-existing CareVoice project was not changed. Configured verified-email Auth and exact workspace origin/callbacks. Free default SMTP rejected custom templates, so the existing PKCE callback works with the supported default template; custom SMTP is still required for reliable outside-team student signup. Hosted public configuration is active in ignored .env.local, while .local/local.env exclusively configures account-creating tests. No local users/balances were migrated. Added repeatable hosted checks/migration/configuration and explicit environment-switch scripts. Node 24.5+ startup/build uses native environment proxies; lockfile changes only record that runtime requirement. No new dependency remains.

Implemented participant/funding/state/window checks, unpredictable stable room mapping, per-member 8/minute grants and private table denial. The responsive call screen includes camera/microphone preview and cleanup, permission messages, Jitsi embedding, native controls, leave/rejoin, network status and new-tab authentication fallback. State polling/window timers close the embedded app view; access/exit never settles credits. Public Jitsi links may allow outsiders or remain usable after the app window, and this is visible before joining. The first host may need Jitsi authentication. There is no fabricated join token, guaranteed provider revocation or claim of a private call.

Verified: 24 unit tests and all 13 real-local integration/mobile tests passed. New checks cover anonymous/outsider/injected inputs, accepted funding and timing, stable shared random rooms, rate limits, private mapping denial and unchanged wallets/ledger. Mobile browser tests cover the public-room notice, early disabled access, permission-denied recovery, leave/rejoin, navigation and no overflow. The Jitsi SDK in the browser adapter test is an explicitly labelled fixture; real Jitsi sign-in/media and two physical smartphones remain untested. Hosted Auth settings returned 200, anonymous hosted catalogue/RPC calls returned 401, and both local/hosted reapplication applied zero migrations. Lint and TypeScript passed. Final production build passed. Hosted-config production smoke verified home/login 200, anonymous wallet/meeting APIs 401, protected meeting redirect and unknown page 404. All seven final SQL files applied successfully in order on a temporary empty PostgreSQL database with Auth/schema stubs; it was removed. After the final clock/UI corrections, targeted meeting API and mobile adapter checks passed again, including a real local dispute closing the embedded fixture and preserving held credits. The public Jitsi external API script returned 200.

The initial Phase 7 provider schema had already been applied before the owner selected public Jitsi. Its history is preserved with a follow-up migration. Reusable environment startup/network/variable instructions are saved as a draft; saving is not publication. The obsolete Daily requirement must be removed in the UI because the draft tool cannot delete secret requirements.

## Next: Phase 8 — Feedback and reputation

Await owner instruction. Build completed-session feedback and server-computed reputation; do not start deployment without separate authorization. Full private video needs a later server/provider configuration decision.

## Limitations

Hosted account signup/delivery is not end-to-end verified and still subject to default SMTP restrictions. The app is not deployed; its workspace Auth origin must become the eventual HTTPS app origin before phone use. Google OAuth, physical-phone Jitsi, public-provider sign-in and future-task restoration remain unverified. The Jitsi integration is explicitly a public classroom demo. No paid resources were created.
