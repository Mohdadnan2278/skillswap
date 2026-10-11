# SkillSwap

SkillSwap connects people who want to teach and learn through time credits. Members choose or add skills, find learning partners, book sessions, meet through Jitsi or Google Meet, and exchange feedback. It includes Google and email authentication, protected profiles, audited credits and an admin panel. Built with Next.js, TypeScript, Tailwind and Supabase.

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

SkillSwap is live at **[skillswap-delta-taupe.vercel.app](https://skillswap-delta-taupe.vercel.app)** on Vercel's Hobby plan. The owner authorized the initial production deployment of Phase 9 source commit `87d48f1` on 2026-10-10; the remote build and live public/protected-route checks passed. Hosted Supabase **SkillSwap** (`avunxagyeywvfjhhowqk`, Mumbai) retains all 13 migrations and uses the matching HTTPS Auth origin/callbacks. Google sign-in is configured; its onboarding was confirmed by the owner. Email/password confirmation still needs email delivery, with custom SMTP absent. Physical-phone calls and real-duration hosted settlement remain manual checks. The first release uses the deployment API; Git pushes do not automatically redeploy it. See [deployment details](docs/DEPLOYMENT.md). No paid resources were created.

## Administration and Google sign-in

The authorized admin extension adds `/admin` with member suspension/restoration, administrator roles, skill management, booking/wallet summaries, dispute review notes, feedback moderation and an immutable audit log. Admin rights are private database membership, checked on the server and in privileged RPCs. Existing credit-transfer rules are unchanged. See [administration and provisioning](docs/ADMIN.md).

Login/signup always show **Continue with Google** and detect Supabase's actual provider availability. The button is disabled until the Google OAuth web client is configured; configuration no longer depends on a stale deployment flag. Google sign-in is enabled in the hosted provider settings. Google-only authentication avoids the email-delivery prerequisite; email/password confirmation still requires email delivery.

## Skills and mobile navigation

On **Profile → Your skills**, search the catalogue or filter by category. If your skill is missing, open **Add a custom skill**, enter its name, choose a category (including Other), and add it to teaching, learning or both. Save your skills to update your profile and discovery matches. Matching names reuse the same skill. New skills work with normal discovery and session booking, and administrators can disable them. Each member can add up to 10 new catalogue skills per rolling 24 hours.

Phones and tablets use a compact Menu with the current page highlighted. Forms stack on narrow screens, primary actions fill the available width, long names wrap, and selected skills remain visible while searching. The optional affiliation is labelled Organization; saved profile values remain compatible.

## Scheduling and credits

Use a member's **Request a session** action, choose an offered skill and a date/time in your saved IANA timezone, select 30/60/90 minutes, review and submit. Bookings show start/end, request expiry, roles and state. The teacher can accept/reject; either participant can cancel before start. Overlapping requests reserve both people's time across teaching/learning roles; rejection/cancellation/expiry releases that time. Requests expire at creation + 24 hours or session start, whichever comes first.

New requests reserve **time and credits**. Verified, onboarded members receive 3 starter credits once. Sessions cost 0.5/1/1.5 credits for 30/60/90 minutes. Reservations reduce availability without moving credits. Rejection, pre-start cancellation or pending expiry releases them. Both participants must confirm after the scheduled end to transfer the exact amount from learner to teacher. Disputes hold funds until both vote to complete (after end) or cancel; mismatched votes have no automatic timeout. Wallet pages show available, reserved and total amounts, private history and active holds.

Historical Phase 5 bookings stay `not_integrated`: create a new request for a funded exchange. They cannot be charged or financially completed. The MVP serializes scheduling/financial routines with one database advisory transaction lock, ordered participant/wallet locks and GiST occupancy constraints. Unique issuance/transfer events, append-only balanced ledger pairs and deferred reconciliation protect financial consistency. This favors correctness for the current release over high-volume throughput.

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

## Public Jitsi integration

Set `VIDEO_PROVIDER=jitsi_demo`. Open an accepted, funded booking and choose **Prepare for demo call**. Check devices, then join within 10 minutes before start through 15 minutes after end. Public Jitsi requires no API key or separate video server; the first participant may have to authenticate with Jitsi. The new-tab option helps when embedded authentication is blocked. Do not distribute room links.

SkillSwap checks participants, state, funding and time on every in-app grant, limits grants to 8 per minute per member, and assigns an unpredictable room name. This does **not** secure public Jitsi outside the app: a leaked link can allow outsiders and remain usable after the app window. The app states this explicitly and does not issue fake private join tokens. Embedded calls close when polling detects a state change or the app window ends, while external Jitsi sessions cannot be revoked by SkillSwap. Native Jitsi handles device selection and reconnect; leaving a call never settles credits. Full private-video enforcement requires a separately configured private provider/server.

The mobile Jitsi adapter test uses an explicitly labelled browser fixture. It verifies UI and guards, not a real media connection, Jitsi sign-in or two phones.

## Google Meet and community feedback

For an accepted funded booking, the teacher can paste a standard `https://meet.google.com/abc-defg-hij` link on the booking page. Both participants can prepare/open it from the meeting page during the join window. Meet opens in a new tab; Google manages sign-in, admission, devices and call limits. There is no embedded Meet SDK, API key, automatic meeting creation or application Google OAuth dependency. Jitsi remains an alternative. Participant-only link storage protects the link inside SkillSwap; copied external links cannot be revoked by the app. No active Daily package, API request or key is used. Historical applied migrations retain the retired provider’s original schema and its subsequent Jitsi conversion.

After both participants complete and settle a session, each can publish one immutable 1–5 star review of the other with an optional comment of at most 500 characters. Names, ratings and plain-text comments are visible to signed-in members. Profile/discovery scores use the server’s average and count; unrated members show no score. **Community** ranks members with at least 3 received ratings by average, count and stable user-ID ties. Scores never grant or spend credits. Feedback supports safe idempotent retries and paginated received reviews.

Phase 9 adds a single two-account browser journey, Vercel configuration, a read-only deployment readiness command and the [two-person session validation checklist](docs/CLASSROOM_DEMO.md). The site is deployed and Google onboarding works. Hosted email delivery, actual Google Meet/Jitsi calls and physical-phone HTTPS checks remain separate validation tasks.

## Phase 9 verification and hosting preparation

See [deployment instructions](docs/DEPLOYMENT.md) and the [two-phone demonstration checklist](docs/CLASSROOM_DEMO.md). `main` includes the merged Phase 8 application. The additional Phase 9 preparation is on `phase-9-demo-readiness`; use that branch or an explicitly approved merge for these release checks.

```sh
npm run demo:check       # Read-only hosted configuration report; exits 1 for blockers
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:demo
```

The integrated journey uses two independently confirmed local accounts, responsive browser screens, real reservations/ledger settlement and feedback. Timing and Jitsi SDK fixtures are clearly identified tests, not a live call or accelerated hosted mode. The readiness command checks the hosted project, migration/RLS/Auth settings and SMTP metadata without exposing credentials or making changes. A passing configuration report does not prove email delivery, deployment or live media. `vercel.json` and `.vercelignore` prepare the dynamic Next.js app for an explicitly authorized Vercel deployment and exclude private local files. No deployment has been performed.
