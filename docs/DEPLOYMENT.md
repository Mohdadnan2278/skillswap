# Hosting SkillSwap

SkillSwap is live at **https://skillswap-delta-taupe.vercel.app**. Vercel's existing Hobby project runs source commit `40673105d0828afb79307a8105be0bf51fd8840a` from `custom-skills-mobile`; deployment `dpl_5nRMtMTaYPPjY3atzikVeM7rKEJT` reached `READY` with the production domain assigned on 2026-10-11. This release adds shared custom skills, responsive navigation/forms and product copy. Supabase retains all 13 migrations and uses this exact HTTPS Auth origin/callbacks. Google onboarding is reported working by the owner. No paid resources were provisioned.

The release uploaded 158 tracked source files allowed by `.vercelignore`; private prompts, login details, environment files and management metadata were excluded. Production checks passed public home/login/signup, available Google UI, authenticated custom-skill/profile UI, normalized existing-skill reuse without creating a hosted test skill, input validation, admin reads, logout and anonymous creation denial. Only the exact seed administrator profile wording created by the assistant was updated through the normal profile API; its password, roles and financial history were preserved. The branch is pushed; GitHub rejected automatic PR creation (Forbidden). Review: https://github.com/sonalreji7/skillswap/pull/new/custom-skills-mobile.

## Vercel configuration prepared

Use the Next.js preset, repository root `.` and Node.js **24.x** (24.5+). `vercel.json` uses frozen-lockfile `npm ci` and `npm run build`; Vercel runs the dynamic Next.js application. Do not use a static export: Auth cookies, route handlers and trusted booking operations require a server. `.vercelignore` excludes local prompts, environment files, management metadata, local databases/tool state and test outputs from CLI uploads. Vercel Git deployments also respect Git ignore rules. No provider CLI or paid service is required for preparation.

The first release was uploaded through Vercel's supported deployment API using securely scoped account access. Only Git-tracked source allowed by `.vercelignore` was uploaded (141 files); environment files, the original prompt, management metadata and generated outputs were excluded. The account token and Supabase management token are not application environment variables. The project is not connected to Git for automatic deployments: pushing a branch does not update the website. For later releases, deliberately choose the reviewed source commit, or connect the repository through the owner's Vercel account and select the intended production branch. Preserve the Hobby plan and do not upgrade automatically. Preview domains are separate origins and are not automatically authorized for sign-in callbacks or mutations.

Configure these values in Vercel **Production** before the production build:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://avunxagyeywvfjhhowqk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's public publishable key or legacy `anon` key from Supabase Project Settings → API; never a secret/service-role key |
| `SITE_URL` | `https://skillswap-delta-taupe.vercel.app` |
| `VIDEO_PROVIDER` | `jitsi_demo` (Google Meet links also work) |
| `GOOGLE_AUTH_ENABLED` | Legacy compatibility value; Google availability comes from live Supabase Auth settings |

The management token, database password, SMTP password and provider secrets do not belong in `NEXT_PUBLIC_*` variables or in the deployed application. `SUPABASE_ACCESS_TOKEN` is used only by management/readiness commands in the development workspace; SkillSwap's app does not need it. There is no Daily key requirement. Keep Vercel's Node runtime selection at 24.x; npm scripts enable the standard Node environment-proxy flag, which is harmless when no proxy is configured.

Obtain the real assigned production domain before configuring callbacks. Set Supabase Auth's Site URL to the same `SITE_URL`, and allow exactly:

- `<production-origin>/auth/callback`
- `<production-origin>/auth/confirm`

The existing management helper can apply those settings after hosting is authorized:

```sh
npm run hosted:configure -- --site-url YOUR_EXACT_HTTPS_ORIGIN
npm run env:hosted
```

Replace the placeholder with the actual origin; do not execute the literal example. Configuration updates hosted Auth and the ignored generated hosted environment; it does not deploy the app or update Vercel's variables. This helper preserves user-managed environment files. Rebuild/redeploy after changing public variables because Next.js embeds them at build time. Do not add wildcard preview callbacks or disable email confirmation to get around setup.

## Confirmation email

Hosted Supabase currently uses its default email service, which restricts delivery outside Supabase organization/team addresses. For ordinary email/password accounts, configure a custom SMTP provider in **Supabase Authentication → Email → SMTP** with its real host, port, username, password and authorized sender. Use the provider's legitimate free tier when appropriate; no provider account, domain purchase or paid service has been provisioned. Keep SMTP credentials in Supabase settings rather than the browser or Git.

After SMTP exists, the authorized `hosted:configure` command can apply the repository confirmation template. Confirm two real emails and test login on the actual site. Default-template PKCE confirmation should be opened in the signup browser; after email confirmation, sign in normally if a different browser lacks the signup verifier. Google OAuth is enabled and is separate from using Google Meet; Google-only authentication does not require this SMTP setup.

## Read-only readiness and local evidence

```sh
npm run demo:check
# Optional: check an existing, ignored environment file instead:
npm run demo:check -- --env-file .local/hosted.env
```

This does not deploy, alter Auth, apply migrations, create accounts or issue credits. It checks HTTPS/public-key/project consistency, hosted Auth connectivity, migration versions, application row security, confirmed-email settings, exact callbacks and signup-provider availability. It prints no credential values and exits **1** if a required setting/check is blocked. Management checks require the already securely bound management token. A passing report establishes configuration checks only. The latest report exits 0: HTTPS origin, all 13 migrations, row security, exact callbacks and Google-backed signup availability pass. Google-only sign-in avoids SMTP; the live button detects provider availability automatically. The owner reports successful Google onboarding. Custom SMTP is still absent for ordinary email/password confirmation. See [admin and Google setup](ADMIN.md).

The preceding admin release passed 29 unit tests and all 19 integration/mobile cases, plus the production checks and Vercel build. Live checks verified the explicitly requested demo administrator's password login, all seven admin sections and `/admin`, logout, anonymous admin API denial, and a visible Google option with its pending setup state. Its random login details are in an ignored private file and were never included in the 153 uploaded source files. No real Google callback or phone media call is claimed.

The initial release reran all 27 unit tests and `npm run check` successfully. Vercel's remote production build also passed. Live HTTP checks returned 200 for home/login/signup, 307 to login for dashboard/wallet/community, 401 for anonymous booking/wallet/leaderboard/review APIs, and 403 for a foreign-origin feedback mutation. Private responses remain `no-store`. No hosted test accounts, financial fixtures or real media calls were created by these checks.

Before an authorized release, run:

```sh
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm run check
```

Do not run a build while the test/development server is using the same checkout. Playwright loads only ignored `.local/local.env` and refuses hosted account-creation targets. `npm run test:demo` runs the single integrated browser journey using real local Auth/PostgreSQL, explicit timing fixtures and a labelled Jitsi SDK fixture. Those fixtures never run in the hosted application and do not verify real media or physical phones.

After authorized deployment, run the [classroom checklist](CLASSROOM_DEMO.md) on the production origin. Verify home/login, sign-in protection, private participant access, email delivery and both phones. Record actual observations; leave untested items pending. Vercel deployment protection must allow the intended demonstrators to access the site, while SkillSwap retains its own login/participant checks. Deleting a deployment does not reset Supabase; rollback uses a known compatible application commit, without resetting financial data or undoing applied migrations.

## Cloud environment versus hosting

Saving/publishing the Codex environment restores development files; it is separate from this Vercel website. The obsolete `DAILY_API_KEY` requirement has been removed from the environment; the unused `api.daily.co` network rule can also be removed in settings. All runtime video features work without that key. Keep the ignored original prompt and credentials out of both Git and deployment uploads.
