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

## Next: Phase 5 — Scheduling and bookings

Await owner instruction. Implement requests, acceptance/rejection/cancellation, participant-only views, database-safe occupancy/transition checks and UTC scheduling. Hosted setup can resume when secure account access is available. Deployment and paid resources remain unauthorized.

## Later phases

5. Scheduling and bookings
6. Credits and completion
7. Private video
8. Feedback and reputation
9. Integration, authorized deployment, and smartphone demo

## Limitations

Phase 3 auth/profile behavior is verified against local services; hosted readiness has not been established. Bookings, wallet/credit transfers, video, and feedback are unavailable. Matching is verified locally. No cloud database or hosting resources have been created.
