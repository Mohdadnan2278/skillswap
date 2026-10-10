# SkillSwap

A student skill-exchange semester project built as one Next.js application with TypeScript, Tailwind, and Supabase. Phase 3 implements email/password authentication, confirmation, profile onboarding/editing, protected navigation, and logout. Phase 4 adds the shared skill catalogue, offered/wanted selections, explained discovery and member profiles. Bookings, credits, video, and reputation are later phases.

## Local development

Use Node 24 (`nvm use` if available), npm, and a running Docker daemon. From the repository root:

```sh
npm ci --cache /tmp/skillswap-npm-cache
npm run db:start
node scripts/configure-local-env.mjs
npm run supabase -- migration up --local
npm run dev
```

The setup helper uses pinned official Supabase slim images from GHCR. It keeps CLI state and local Docker proxy configuration under ignored `.local/`, makes the email template readable, and configures local service networking. No remote database is linked or changed. Existing external HTTPS proxy settings are preserved; local-only containers use direct internal HTTP because their BusyBox health checks ignore `NO_PROXY`. The app uses port 3000; use the same origin as `SITE_URL` for browser requests.

`configure-local-env.mjs` writes generated local `.env.local` with the local URL/public key without printing values. It preserves any user-written `.env.local`; configure those files manually. Confirmation messages appear in the local Mailpit inbox on port 54324. Supabase Auth has email confirmation enabled; accounts must confirm before onboarding. Container data survives ordinary `npm run db:stop`, but live containers must restart in a new task. No fresh-task restoration has been verified.

If Docker is unavailable, the landing and auth setup notice still render; use [hosted configuration instructions](docs/SUPABASE_SETUP.md) for real auth. Do not disable health checks or TLS verification to make setup pass.

## Checks

```sh
npm test                 # Validation/config boundary unit tests
npm run check            # ESLint, Next route types, TypeScript, production build
npm run test:integration  # Real local Auth/PostgreSQL/API tests; no browser needed
npm run test:e2e          # Includes the mobile Chromium workflow
```

Integration tests create uniquely named accounts only on loopback Supabase/app origins and require local Mailpit; they refuse hosted URLs. They start their own app on the configured `SITE_URL` port, which must be free. Browser tests require Playwright's Chromium (`npx playwright install chromium`) or an existing compatible executable:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Browser cache/config folders use writable temporary paths in this cloud machine. Test output and local prompts are ignored. Synthetic local accounts remain in the local database; Phase 4 tests clear only their own selections after use. Tests do not delete existing users or reset user data.

After a successful build, `npm start` serves production. Stop app processes before reinstalling dependencies or building. `npm run db:start` is repeatable; `npm run db:stop` stops this project's containers while retaining their data. Later migrations can be applied locally with `npm run supabase -- migration up --local`; never run a reset on data you need to preserve.

## Structure

- `src/app/`: App Router pages, protected member route group, callback handlers, and HTTP endpoints.
- `src/frontend/`: auth/profile/skill-selection/navigation UI components.
- `src/backend/`: config, verified session guard, Supabase server client/schema types, profile/skills/discovery services, HTTP validation/errors.
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

Vercel is the planned host; use the Next.js preset and repository root. Configure the hosted Supabase URL/public key and HTTPS `SITE_URL` before building. Hosted project creation and migration setup are authorized but blocked by missing `SUPABASE_ACCESS_TOKEN`; enter it securely in environment settings. Hosted provider configuration, Google OAuth and deployment have not been verified. Deployment needs separate authorization. No paid resources have been created.
