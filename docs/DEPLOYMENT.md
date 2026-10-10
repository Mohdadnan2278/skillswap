# Hosting SkillSwap

Phase 9 prepares hosting; no deployment is authorized or performed yet. The tested code is on `phase-9-demo-readiness`. `main` now includes the merged Phase 8 application (verified during this phase); Phase 9 preparation is on its own branch until an approved merge. Do not merge or deploy implicitly.

## Vercel configuration prepared

Use the Next.js preset, repository root `.` and Node.js **24.x** (24.5+). `vercel.json` uses frozen-lockfile `npm ci` and `npm run build`; Vercel runs the dynamic Next.js application. Do not use a static export: Auth cookies, route handlers and trusted booking operations require a server. `.vercelignore` excludes local prompts, environment files, management metadata, local databases/tool state and test outputs from CLI uploads. Vercel Git deployments also respect Git ignore rules. No provider CLI or paid service is required for preparation.

Once the owner authorizes deployment, import `sonalreji7/skillswap` into the owner's Vercel account and deliberately select `phase-9-demo-readiness` as the source/production branch, or use an explicitly approved merged commit. Check Hobby/free-plan eligibility and do not upgrade or provision paid resources automatically. Use one stable production domain for the classroom demo. Preview domains are separate origins and are not automatically authorized for sign-in callbacks or mutations.

Configure these values in Vercel **Production** before the production build:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://avunxagyeywvfjhhowqk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The project's public publishable key or legacy `anon` key from Supabase Project Settings → API; never a secret/service-role key |
| `SITE_URL` | The exact assigned HTTPS production origin, without path, query or trailing slash |
| `VIDEO_PROVIDER` | `jitsi_demo` (Google Meet links also work) |
| `GOOGLE_AUTH_ENABLED` | `false` unless Google sign-in is separately configured and tested |

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

Hosted Supabase currently uses its default email service, which restricts delivery outside Supabase organization/team addresses. For two ordinary student accounts, configure a custom SMTP provider in **Supabase Authentication → Email → SMTP** with its real host, port, username, password and authorized sender. Use the provider's legitimate free tier when appropriate; no provider account, domain purchase or paid service has been provisioned. Keep SMTP credentials in Supabase settings rather than the browser or Git.

After SMTP exists, the authorized `hosted:configure` command can apply the repository confirmation template. Confirm two real emails and test login on the actual site. Default-template PKCE confirmation should be opened in the signup browser; after email confirmation, sign in normally if a different browser lacks the signup verifier. Optional Google OAuth is separate from using Google Meet and is not needed for this demo.

## Read-only readiness and local evidence

```sh
npm run demo:check
# Optional: check an existing, ignored environment file instead:
npm run demo:check -- --env-file .local/hosted.env
```

This does not deploy, alter Auth, apply migrations, create accounts or issue credits. It checks HTTPS/public-key/project consistency, hosted Auth connectivity, migration versions, application row security, confirmed-email settings, exact callbacks and SMTP metadata. It prints no credential values and exits **1** if a required setting/check is blocked. Management checks require the already securely bound management token. A passing report establishes configuration checks only; it explicitly lists live email, real phones and real-duration completion as manual checks. The current report correctly blocks the loopback app origin and missing SMTP.

Before an authorized release, run:

```sh
npm test
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm run check
```

Do not run a build while the test/development server is using the same checkout. Playwright loads only ignored `.local/local.env` and refuses hosted account-creation targets. `npm run test:demo` runs the single integrated browser journey using real local Auth/PostgreSQL, explicit timing fixtures and a labelled Jitsi SDK fixture. Those fixtures never run in the hosted application and do not verify real media or physical phones.

After authorized deployment, run the [classroom checklist](CLASSROOM_DEMO.md) on the production origin. Verify home/login, sign-in protection, private participant access, email delivery and both phones. Record actual observations; leave untested items pending. Vercel deployment protection must allow the intended demonstrators to access the site, while SkillSwap retains its own login/participant checks. Deleting a deployment does not reset Supabase; rollback uses a known compatible application commit, without resetting financial data or undoing applied migrations.

## Cloud environment versus hosting

Saving/publishing the Codex environment restores development files; it does not publish a Vercel website. Remove the obsolete `DAILY_API_KEY` requirement and `api.daily.co` rule in environment settings before publishing the cloud snapshot; the draft tool cannot delete secret requirements. All runtime video features work without that key. Keep the ignored original prompt and credentials out of both Git and deployment uploads.
