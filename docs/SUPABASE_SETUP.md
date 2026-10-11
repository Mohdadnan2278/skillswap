# Supabase setup and Phase 3–5 verification

## Local setup (verified in the current cloud machine)

Requires Node 24, npm, Docker, and registry access to `ghcr.io` plus its package artifact destinations. Use the pinned dependencies from `package-lock.json`.

```sh
npm ci --cache /tmp/skillswap-npm-cache
npm run db:start
node scripts/configure-local-env.mjs
npm run supabase -- migration up --local
npm run dev
```

The local CLI wrapper sets `SUPABASE_HOME` under `.local`, selects official catalog-pinned slim images with checksum/digest verification intact, and uses the official GHCR mirror instead of denied ECR downloads. Only services needed for Auth/PostgreSQL/PostgREST/Mailpit are kept running; CLI bootstrap jobs may still briefly use other images.

The cloud Docker client supplies proxy settings to containers. The wrapper preserves existing external HTTPS proxies, adds exact local service names to no-proxy settings, and removes HTTP proxying from these local-only containers so BusyBox loopback health checks can run. It writes a private local Docker client config without copying registry credentials. It never edits the user's original Docker config or changes global networking. Public template mode 644 lets the Kong container read the confirmation template; this file contains placeholders only.

Generated `.env.local` values and process credentials are never printed. A pre-existing user-written env file is preserved. Local accounts/data remain local; restarting containers reuses their volumes when available, and generated env settings can be refreshed by the helper. Publication does not preserve running processes, and fresh-task Docker volume restoration has not been tested.

Local email confirmation uses `supabase/templates/confirmation.html` and `/auth/confirm`, making confirmation independent of the original browser's PKCE verifier. Open the local Mailpit inbox on port 54324 in your own local setup to retrieve confirmation messages. The application also supports `/auth/callback` for PKCE OAuth/default confirmation redirects.

No wallet or starter credits are granted during Phase 3. This migration must not mint money; Phase 6 will provision eligible users idempotently.

## Hosted setup (not performed)

1. Choose/create your Supabase project in your own dashboard. No resource or billing changes are made by this repository.
2. Copy `.env.example` to ignored `.env.local` or add equivalent app host/environment settings:
   - `NEXT_PUBLIC_SUPABASE_URL`: exact project HTTPS URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the public publishable key from project API settings. Legacy local anon JWTs are also accepted; service-role JWTs and `sb_secret_` keys are rejected. Never use a private key here.
   - `SITE_URL`: exact app origin, e.g. the HTTPS origin of your authorized deployment; no path, query, or trailing route.
   - `GOOGLE_AUTH_ENABLED` is retained for older configuration compatibility; login/signup now use Supabase's actual public Google-provider status.
3. Enable email/password signup, require email confirmation, and use a minimum password length of at least 8. Configure provider rate limits and production SMTP as appropriate. If a stricter password policy is enabled, the auth service remains authoritative and the UI reports weak-password errors.
4. In Supabase Authentication URL settings, set Site URL to the same `SITE_URL`. Add only the intended callback URLs: `<SITE_URL>/auth/callback` and local development callback origins you actually use. Do not use an unrestricted redirect wildcard for production.
5. When custom SMTP is configured, replace the confirmation email body with the placeholder-only template in `supabase/templates/confirmation.html`, or the equivalent link `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a>`. Never paste real tokens or private keys into templates. Free projects using default SMTP cannot edit this template. The default PKCE confirmation flow uses the existing callback when opened in the original browser; cross-device links may lack the verifier, so the token-hash template is recommended.
6. Review all versioned migrations in `supabase/migrations/`, in timestamp order. Apply it to the chosen hosted project only after explicitly authorizing that database change (through Supabase SQL editor or your normal approved migration workflow). Do not run local reset commands against a hosted database. The local CLI wrapper is for local infrastructure; do not assume it has hosted login credentials.
7. Configure Internet access for the specific project API hostname (or configured custom domain), and for Google destinations only if OAuth is enabled. The current SkillSwap hostname is `avunxagyeywvfjhhowqk.supabase.co`; preserve unrelated allowlist entries when adding it.
8. Restart/rebuild the app after changes to the public URL/key. Production builds inline `NEXT_PUBLIC_` values. Run the two-account manual checklist below before claiming hosted auth readiness.

These steps need public project settings, not a service-role key. Enter credentials securely in environment/provider settings; never send secret values in chat or commit real environment files.

## Google OAuth

Follow the current [Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google). Configure a Google OAuth Web client/consent screen and paste its client ID and secret into Supabase's Google provider settings, not browser code. Add the exact Supabase provider callback (`https://<project-ref>.supabase.co/auth/v1/callback`, or the callback shown for your configured domain) to Google's authorized redirect URIs. Add `<SITE_URL>/auth/callback` to Supabase's redirect allowlist. The button is visible with a disabled status until the actual provider is available; enabling Google in Supabase activates it without redeploying or changing the legacy environment flag. See [admin and Google configuration](ADMIN.md) for this project's exact URLs and the optional secure management helper.

Google uses the same account/profile permissions. The app sends an OAuth request through Supabase, stores the PKCE verifier in cookies, and exchanges the returned code on the server. Redirect targets are a fixed allowlist of implemented internal routes. No Google provider secret is needed in this app. Google-only sign-in can avoid SMTP; ordinary email/password signup still needs confirmation email delivery. A visible Google button alone does not establish provider readiness.

## Evidence and manual checklist

Automated local tests cover:

- Two separate real accounts, email confirmation, verified login, profile onboarding/update and persistence.
- Rejecting unconfirmed login, malformed/forged auth cookies, injected owner IDs, invalid timezones, unknown fields and oversized requests.
- Anonymous Data API/RPC denial, cross-user direct update denial, private timezone RLS, safe public profile projection, and database validation with atomic rollback.
- Foreign-origin mutation rejection, callback replay failure, local logout and independent sessions.
- Chromium at 390×844: signup, confirmation, device timezone selection, onboarding, edit/reload, logout, protected redirect, and sign-in again; dashboard has no horizontal overflow.

For a hosted project, repeat the flow with two real accounts in separate browser sessions: confirm both emails, edit one profile, verify the other remains unchanged, inspect network errors for unauthorized requests, logout one, and verify the other remains signed in. Test an expired link and an unavailable provider. Repeat on physical smartphones over HTTPS before reporting phone readiness. The owner reports working Google onboarding, and the hosted provider is enabled with its credentials present. Production SMTP delivery, physical phones and fresh-task restoration remain separate checks; hosted RLS is checked by the read-only readiness command.

## Official guidance consulted

- [SSR client setup and session verification](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [SSR advanced guide: getUser, token revocation, and cache behavior](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Email/password](https://supabase.com/docs/guides/auth/passwords)
- [Supabase CLI](https://github.com/supabase/cli)
- Version-matched Next.js authentication, cookies, and proxy docs bundled in `node_modules/next/dist/docs/`.

The public Supabase docs host returned 403 in this cloud environment; SSR guidance was read from the official Supabase repository's documentation source instead.

## Hosted access status

Historical Phase 4 check: `SUPABASE_ACCESS_TOKEN` is absent from the running machine; the saved secure requirement has `has_saved_binding=false`; CLI `projects list` reports a missing token. The requirement is scoped to `api.supabase.com`. Enter the personal access token securely in environment settings, review/save the draft and publish the environment as appropriate; never paste token values in chat. A draft requirement does not supply a credential or create a project. Hosted project creation/configuration is authorized; no hosted project, migration or billing resource has been changed. Phase 4 proceeds locally under the owner's latest continuation instruction.

Local Phase 4 checks passed for skill selection ownership/counts/duplicates, unknown IDs and atomic rollback, concurrent replacements, explained matching/self exclusion, validated cursors/pagination, and mobile skill save→reload→discovery→member profile. Apply all versioned migrations to the authorized hosted project once access is available, then separately verify hosted RLS and email delivery.

## Phase 5 local scheduling

Apply `20261010190000_scheduling_bookings.sql` locally without resetting data. It installs `btree_gist`, bookings, private occupancy/idempotency and restricted scheduling routines. No financial tables or provider resources are created. Local tests exercise participant RLS, direct-write denial, role/state/time rules, expiry, safe replay, both-role overlap/concurrent requests and adjacent intervals. Local-only SQL fixtures advance request deadlines or session starts to test guards; no real elapsed-hour or credit-transfer claim is made.

The owner supplied a credential-file location on their computer (`supabase/supabase.env`), then confirmed that it is in the personal checkout, not this cloud workspace. The cloud file is absent and hosted access remains blocked. `supabase/supabase.env` is explicitly Git-ignored; if the file later becomes available here, load it server-side for management CLI commands without logging values. Do not commit or request its contents in chat. The owner authorized continuing Phase 5 locally while catching up on setup.

## Phase 6 local finance

Apply `20261010200000_credits_completion.sql` with the local migration command above. Eligible verified/onboarded users receive the uniquely guarded 180-unit grant, including existing profiles. New requests reserve credits atomically; historical previews stay unfunded. Wallet, ledger, confirmation/dispute RLS and restricted RPCs are exercised by `credits.spec.ts`, with mobile wallet checks in `credits-ui.spec.ts`. Local deadline/end fixtures require Docker and use no extra credit grants. No hosted migration has been applied. Updated cloud startup instructions are saved as a draft; review/save and publish in environment settings to activate them.

## Hosted transition after Phase 7 authorization

Supabase account access is now verified. Created free-plan project `avunxagyeywvfjhhowqk` (SkillSwap, Mumbai) and applied all seven versioned migrations with transactional history. The existing CareVoice project was left unchanged. Hosted public configuration lives in ignored `.local/hosted.env`; `npm run env:hosted` activates it. `.local/local.env` remains dedicated to account-creating local tests. No local users, sessions or wallet rows were uploaded.

Hosted Auth requires confirmed email and uses the default PKCE confirmation/callback flow. The free default email provider rejects custom template changes; setup applies a custom template only when custom SMTP exists. Default SMTP delivery restrictions still apply. This workspace’s Auth origin is `http://127.0.0.1:3000`; update it to the eventual HTTPS application origin with `hosted:configure` before deployment. Do not fabricate a deployed URL. Native Node environment proxy support is enabled in dev/build/start and management scripts; preserve proxy/TLS settings.

Public Jitsi demo mode needs no video secret. Remove any unused `DAILY_API_KEY` requirement from environment settings after the provider switch; the configuration tool can add requirements but cannot delete them. Review/save the startup/network draft and publish when ready. Publication/restoration and a real two-phone call are not implied by these local checks.

## Phase 8 continuation

Apply the three new migrations (Google Meet, feedback/reputation and actor qualification) through `hosted:migrate` under the owner’s existing hosted setup authorization. Local tests use only `.local/local.env`; active hosted configuration is preserved. Google Meet links need no environment variable, Google API key or OAuth setup. `VIDEO_PROVIDER=jitsi_demo` continues to enable the optional embedded Jitsi demo.

Quick-call support adds `20261011120000_quick_calls.sql` (14 migrations total). Apply it locally with `npm run supabase -- migration up --local` and to the authorized hosted project with `npm run hosted:migrate` before deploying the Start now form. It preserves existing bookings, financial history, RLS and working Google Auth settings; no new key or provider configuration is required.

No active Daily integration remains. Its original applied migration is preserved for database history. The environment draft tool cannot delete requirements: remove the obsolete video key requirement and its `api.daily.co` destination in environment settings. Neither video flow needs that key. Review/save/publish updates for the current branch snapshot.

Current verification: all 10 migrations are applied locally and to hosted SkillSwap; repeated hosted migration applies zero changes. Hosted Auth settings return 200; anonymous feedback/reputation and new RPCs return 401. Complete signed-in workflows are verified locally, not against hosted email or real video media.
