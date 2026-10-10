# SkillSwap

A student skill-exchange semester project built as one Next.js application with TypeScript, Tailwind, and Supabase. Phase 3 implements email/password authentication, confirmation, profile onboarding/editing, protected navigation, and logout. Phase 4 adds the shared skill catalogue, offered/wanted selections, explained discovery and member profiles. Phase 5 adds a scheduling preview: requests, acceptance/rejection/cancellation, expiry and private booking screens. Phase 6 adds starter credits, wallet/history, funded reservations, releases, two-party completion and mutual dispute resolution. Phase 7 adds an explicitly public Jitsi classroom demo with device checks and guarded in-app access. Teacher-added Google Meet links are also available. Phase 8 implements immutable completed-session feedback, server-calculated reputation and a community leaderboard.

## Local development

Use Node 24.5 or later (`nvm use` if available), npm, and a running Docker daemon. From the repository root:

```sh
npm ci --cache /tmp/skillswap-npm-cache
npm run db:start
node scripts/environment.mjs prepare-tests
npm run env:local
npm run supabase -- migration up --local
npm run dev
```

The setup helper uses pinned official Supabase slim images from GHCR. It keeps CLI state and local Docker proxy configuration under ignored `.local/`, makes the email template readable, and configures local service networking. No remote database is linked or changed. Existing external HTTPS proxy settings are preserved; local-only containers use direct internal HTTP because their BusyBox health checks ignore `NO_PROXY`. The app uses port 3000; use the same origin as `SITE_URL` for browser requests.

`environment.mjs` prepares ignored `.local/local.env` for tests and switches generated app configuration explicitly. It preserves user-managed `.env.local` files. Test configuration always uses loopback Supabase, independently of the active app environment. Confirmation messages appear in the local Mailpit inbox on port 54324. Supabase Auth has email confirmation enabled; accounts must confirm before onboarding. Container data survives ordinary `npm run db:stop`, but live containers must restart in a new task. No fresh-task restoration has been verified.

If Docker is unavailable, the landing and auth setup notice still render; use [hosted configuration instructions](docs/SUPABASE_SETUP.md) for real auth. Do not disable health checks or TLS verification to make setup pass.

## Checks

```sh
npm test                 # Validation/config boundary unit tests
npm run check            # ESLint, Next route types, TypeScript, production build
npm run test:integration  # Real local Auth/PostgreSQL and feature/mobile checks
npm run test:e2e          # Includes the mobile Chromium workflow
```

Integration tests create uniquely named accounts only on loopback Supabase/app origins and require local Mailpit; they refuse hosted URLs. They start their own app on the configured `SITE_URL` port, which must be free. Browser tests require Playwright's Chromium (`npx playwright install chromium`) or an existing compatible executable:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright loads `.local/local.env`, verifies it is loopback and passes it explicitly to the test server; it never loads active hosted `.env.local`. Browser cache/config folders use writable temporary paths in this cloud machine. Test output and local prompts are ignored. Synthetic local accounts remain in the local database; Phase 4–6 tests clear their own selections and cancel their own future requests after use. Local booking deadline/end-time fixtures advance timestamps to exercise timing guards; they do not claim real elapsed sessions. Financial tests use real PostgreSQL transactions and each account’s normal one-time grant, without extra demo credits. Tests do not delete existing users or reset user data.

After a successful build, `npm start` serves production. Stop app processes before reinstalling dependencies or building. `npm run db:start` is repeatable; `npm run db:stop` stops this project's containers while retaining their data. Later migrations can be applied locally with `npm run supabase -- migration up --local`; never run a reset on data you need to preserve.

## Structure

- `src/app/`: App Router pages, protected member route group, callback handlers, and HTTP endpoints.
- `src/frontend/`: auth/profile/skill-selection/scheduling/navigation UI components.
- `src/backend/`: config, verified session guard, Supabase server client/schema types, profile/skills/discovery/booking/wallet services, HTTP validation/errors.
- `src/shared/`: shared DTOs and runtime input schemas.
- `supabase/`: local configuration, confirmation template, and versioned database migrations.
- `scripts/`: reproducible local Supabase/environment helpers.
- `tests/`: unit, integration, and mobile UI checks.
- `docs/`: setup, API/database design, UI plan, and phase progress.
- `.local/PROJECT_PROMPT.txt`: original project prompt, excluded from Git.

## Security and configuration

Only use the project's public publishable key in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no service-role/secret key is used by the application. Identity is validated on the server with `getUser()`; `getClaims()` in `src/proxy.ts` refreshes cookies. Private responses are not cached. The `save_my_profile` database function derives the actor, checks verified email, and writes profile/preferences atomically. RLS protects preferences, and ordinary API roles cannot directly mutate profile rows or onboarding timestamps. Skill choices are replaced atomically through `replace_my_skills`, which derives the actor, requires verified onboarding, enforces enabled IDs/counts/uniqueness and serializes concurrent saves. Discovery matches wanted-to-offered skills in stable member ID order; no rating or credit data is simulated.

See [Supabase setup](docs/SUPABASE_SETUP.md), [MVP specification](PROJECT_SPEC.md), [API contract](docs/API_CONTRACT.md), [database design](docs/DATABASE_SCHEMA.md), [UI plan](docs/UI_PLAN.md), and [progress](docs/PROGRESS.md).

## Hosting

SkillSwap is live at **[skillswap-delta-taupe.vercel.app](https://skillswap-delta-taupe.vercel.app)** on Vercel's Hobby plan. The owner authorized the production deployment of Phase 9 source commit `87d48f1` on 2026-10-10; the remote build and live public/protected-route checks passed. Hosted Supabase **SkillSwap** (`avunxagyeywvfjhhowqk`, Mumbai) retains all 10 migrations and uses the matching HTTPS Auth origin/callbacks. Email confirmation is required, and custom SMTP is still needed for ordinary student signup. Actual email delivery, physical-phone calls and real-duration hosted settlement remain pending. The first release uses the deployment API; Git pushes do not automatically redeploy it. See [deployment details](docs/DEPLOYMENT.md). No paid resources were created.

## Scheduling and credits

Use a member's **Request a session** action, choose an offered skill and a date/time in your saved IANA timezone, select 30/60/90 minutes, review and submit. Bookings show start/end, request expiry, roles and state. The teacher can accept/reject; either participant can cancel before start. Overlapping requests reserve both people's time across teaching/learning roles; rejection/cancellation/expiry releases that time. Requests expire at creation + 24 hours or session start, whichever comes first.

New requests reserve **time and credits**. Verified, onboarded members receive 3 starter credits once. Sessions cost 0.5/1/1.5 credits for 30/60/90 minutes. Reservations reduce availability without moving credits. Rejection, pre-start cancellation or pending expiry releases them. Both participants must confirm after the scheduled end to transfer the exact amount from learner to teacher. Disputes hold funds until both vote to complete (after end) or cancel; mismatched votes have no automatic timeout. Wallet pages show available, reserved and total amounts, private history and active holds.

Historical Phase 5 bookings stay `not_integrated`: create a new request for a funded exchange. They cannot be charged or financially completed. The MVP serializes scheduling/financial routines with one database advisory transaction lock, ordered participant/wallet locks and GiST occupancy constraints. Unique issuance/transfer events, append-only balanced ledger pairs and deferred reconciliation protect financial consistency. This favors correctness for the semester project over high-volume throughput.

## Switch between hosted app and local tests

```sh
npm run hosted:check
npm run hosted:migrate                          # Explicit remote mutation; inspect the target first
npm run hosted:configure -- --site-url http://127.0.0.1:3000
npm run env:hosted                              # Copies ignored public hosted settings into .env.local
node scripts/environment.mjs prepare-tests      # Local test settings; preserves hosted app selection
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
# To develop the app against local services again:
npm run env:local
```

`SUPABASE_ACCESS_TOKEN` is needed only for management commands. `SUPABASE_PROJECT_REF` or `--project-ref` selects the project; this workspace also retains ignored management metadata. Management migration history is written in the same transaction as each migration. Untracked existing application tables block first-time migration. No local accounts, test data or balances are copied to hosted Supabase. Generated environment files and management metadata remain ignored. Restart after changing environment; rebuild production because Next.js compiles public variables. npm startup/build scripts enable Node’s native environment proxy support for this cloud machine.

Before deployment, configure the exact HTTPS app origin in both `SITE_URL` and hosted Auth, configure custom SMTP if students outside your Supabase team need email, rebuild, and validate real signup/login. Creating the database did not deploy the application.

## Jitsi classroom demo

Set `VIDEO_PROVIDER=jitsi_demo`. Open an accepted, funded booking and choose **Prepare for demo call**. Check devices, then join within 10 minutes before start through 15 minutes after end. Public Jitsi requires no API key or separate video server; the first participant may have to authenticate with Jitsi. The new-tab option helps when embedded authentication is blocked. Do not distribute room links.

SkillSwap checks participants, state, funding and time on every in-app grant, limits grants to 8 per minute per member, and assigns an unpredictable room name. This does **not** secure public Jitsi outside the app: a leaked link can allow outsiders and remain usable after the app window. The app states this explicitly and does not issue fake private join tokens. Embedded calls close when polling detects a state change or the app window ends, while external Jitsi sessions cannot be revoked by SkillSwap. Native Jitsi handles device selection and reconnect; leaving a call never settles credits. Full private-video enforcement requires a separately configured private provider/server.

The mobile Jitsi adapter test uses an explicitly labelled browser fixture. It verifies UI and guards, not a real media connection, Jitsi sign-in or two phones.

## Google Meet and community feedback

For an accepted funded booking, the teacher can paste a standard `https://meet.google.com/abc-defg-hij` link on the booking page. Both participants can prepare/open it from the meeting page during the join window. Meet opens in a new tab; Google manages sign-in, admission, devices and call limits. There is no embedded Meet SDK, API key, automatic meeting creation or application Google OAuth dependency. Jitsi remains an alternative. Participant-only link storage protects the link inside SkillSwap; copied external links cannot be revoked by the app. No active Daily package, API request or key is used. Historical applied migrations retain the retired provider’s original schema and its subsequent Jitsi conversion.

After both participants complete and settle a session, each can publish one immutable 1–5 star review of the other with an optional comment of at most 500 characters. Names, ratings and plain-text comments are visible to signed-in members. Profile/discovery scores use the server’s average and count; unrated members show no score. **Community** ranks members with at least 3 received ratings by average, count and stable user-ID ties. Scores never grant or spend credits. Feedback supports safe idempotent retries and paginated received reviews.

Phase 9 adds a single two-account browser journey, Vercel configuration, a read-only deployment readiness command and the [classroom demonstration checklist](docs/CLASSROOM_DEMO.md). Hosted email delivery, actual Google Meet/Jitsi calls, physical-phone HTTPS checks and authorized deployment are still outstanding.

## Phase 9 verification and hosting preparation

See [deployment instructions](docs/DEPLOYMENT.md) and the [two-phone demonstration checklist](docs/CLASSROOM_DEMO.md). `main` includes the merged Phase 8 application. The additional Phase 9 preparation is on `phase-9-demo-readiness`; use that branch or an explicitly approved merge for these release checks.

```sh
npm run demo:check       # Read-only hosted configuration report; exits 1 for blockers
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:demo
```

The integrated journey uses two independently confirmed local accounts, responsive browser screens, real reservations/ledger settlement and feedback. Timing and Jitsi SDK fixtures are clearly identified tests, not a live call or accelerated hosted mode. The readiness command checks the hosted project, migration/RLS/Auth settings and SMTP metadata without exposing credentials or making changes. A passing configuration report does not prove email delivery, deployment or live media. `vercel.json` and `.vercelignore` prepare the dynamic Next.js app for an explicitly authorized Vercel deployment and exclude private local files. No deployment has been performed.
