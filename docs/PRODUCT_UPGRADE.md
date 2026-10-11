# Product upgrade and rollback

The owner subsequently authorized the friendly production address; the exact same demo source was rebuilt with that origin. See [domain configuration](FRIENDLY_URL.md). This changes the retained deployment/origin, not the unreleased upgrade status.

## Preserved working release

The owner reports successful Google onboarding, a live Jitsi call and a 0.5-credit transfer leaving 2.5 and 3.5 credits. Production remains `https://skillswap-comm.vercel.app`, deployment `dpl_67e2bxdGytmLjsDNoWQX6FbYa5pU`, source `69b77dc88186ca9c046459efeb62c8080af5084b`.

- Git tag: `demo-working-2026-10-11` — exact production application source.
- Backup branch: `demo-backup-2026-10-11` — merged working release, including release documentation.
- Upgrade branch: `product-upgrade` — isolated development and review.

The backups are pushed. This upgrade does not replace the working deployment or alter the hosted database during implementation. It uses two additive migrations. Existing financial tables, applied migrations, starter grants and standard/demo booking terms remain compatible with the old application.

## Included improvements

- Admin/Community session refresh now persists response cookies.
- Standard active bookings refresh, and lists default to actionable sessions with skill/partner names. History is separate and newest first; API clients retain the default all-bookings behavior. Booking page cursors preserve PostgreSQL microseconds so rapid requests do not repeat or disappear between pages.
- Opt-in availability lasts 15, 30 or 60 minutes. Discover can show only available teachers. Availability expires; it is not a presence guarantee or automatic acceptance.
- Recipient-only booking notifications are created transactionally for requests, state changes and completion confirmations. Explicit read controls and navigation badges are included. Polling pauses in hidden tabs; in-app notification polling is not email or push delivery.
- Support cancellation releases held reservations only for accepted/disputed bookings, by an uninvolved admin, after 24 hours past the end or when a participant is suspended. Mandatory reasons, replay protection and immutable audits apply. Both parties are notified. This cannot force payment or change settled balances.
- Forgotten-password and reset screens use Supabase recovery. A reset signs out other sessions. Default PKCE emails must be opened in the requesting browser; a configured token-hash recovery template supports cross-device links.
- Hosted email signup/recovery default off until `EMAIL_DELIVERY_ENABLED=true` is explicitly configured after SMTP testing. Google signup and existing password login remain available. Local isolated tests use their local mail inbox.
- Unexpected API failures receive a request ID and sanitized status/code logs; no tokens, cookies, request bodies or provider details are logged.
- CI prepares unit, build, integration and mobile checks. The GitHub workflow itself needs an actual remote run before claiming CI passed.
- Discover, public profiles and request summaries load only selected skills. The editing form still loads the full catalogue; a large-catalogue server-search UI and finer financial locks remain future scaling work.

## Jitsi timing

The five-minute **Start now** setting is an acceptance deadline. Standard sessions still have 30/60/90-minute scheduled durations. Short Demo sessions use the admin policy. Joining early does not accelerate completion eligibility.

The public `meet.jit.si` configuration announces new provider meeting limits and links to https://jitsi.org/blog/changes-coming. This environment could read the configuration but could not retrieve that policy page to establish the exact public-provider duration. If Jitsi imposes a five-minute cap, SkillSwap cannot remove it. Use the teacher-saved Meet option when appropriate. Neither provider currently supplies attendance timing to SkillSwap.

## Deliberate rollout

1. Review the branch, run the documented local tests, and retain the old Vercel deployment.
2. Apply `20261011150000_product_upgrade.sql` and `20261011150100_booking_list_views.sql` using the existing authorized migration helper. Do not reset the database or change applied historical files. Hosted migration readiness will intentionally fail before these are applied.
3. For reliable expiry, inspect the worker/scheduler using `node --use-env-proxy scripts/schedule-expiry.mjs`. After reviewed migrations, run the same command with `--apply` to enable/update the named one-minute Supabase Cron job. This requires the existing owner management binding. The worker only expires overdue pending requests; it cannot settle an accepted session. No job was enabled on production during development.
4. Keep Google configured and `EMAIL_DELIVERY_ENABLED=false` until a legitimate SMTP sender is configured and tested. To enable email, use the existing authorized `hosted:configure` helper with the exact production origin; it adds the exact `/auth/recovery` callback and applies both templates when SMTP exists. Configure the corresponding Vercel server variable; do not deploy SMTP/management credentials to the app.
5. Deliberately deploy the reviewed upgrade commit on the existing free Vercel project. Git pushes do not currently auto-deploy. An arbitrary preview URL must not be used as a replacement production Auth origin.
6. Verify existing Google/password login, the existing demo mode, availability, incoming alerts and a real transfer on the released site. Confirm all 18 migrations, RLS on 14 public app tables and the active expiry job. Never create synthetic hosted balances or accounts to make this check pass.

## Returning to the working application

Use Vercel's deployment view to promote the retained READY deployment `dpl_67e2bxdGytmLjsDNoWQX6FbYa5pU` back to production. Alternatively rebuild the exact Git tag `demo-working-2026-10-11` with the original production configuration. The backup branch includes the same application source. Preserve the existing site URL, Google credentials and domain.

Do **not** roll back ledger data, delete new tables, reset migration history or restore old balances. Keep additive migrations and legitimately recorded cancellations/transfers. The old app does not depend on availability/notification tables and remains compatible. If a scheduled expiry job is implicated, disable only the named `skillswap-expire-pending` job after inspecting its run history; the old app's normal lazy expiry still works.

## Checks and remaining external requirements

Required local checks: `npm test`, `npm run check`, and `npm run test:integration`, using only `.local/local.env`. In this cloud workspace, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` for browser checks. Fresh environments can instead install Playwright's supported Chromium and system dependencies as CI does.

Verification for this branch: 39 unit tests passed, and lint, Next route types, TypeScript and the production build passed. The full selected integration run passed 26 cases, including the actual elapsed two-person demo and exact-once transfer. A subsequent run passed all seven upgrade cases and four of five older mobile UI cases; the remaining case had an outdated expectation that cancelled bookings appear in the default active view. Updating it to choose History passed its focused rerun. Across those runs, all 32 distinct local integration/browser cases have passing evidence, including the timestamp-precision regression. Tests use only loopback services. The expiry worker is tested locally; production Cron remains unconfigured. CI's remote workflow and fresh-environment restoration have not been verified.

The read-only hosted readiness check confirms existing health, Google and Auth origin settings. It deliberately reports the upgrade migration/new-table/worker/scheduler prerequisites as pending; those findings do not mean the preserved live demo is broken. No hosted setting or database row was changed by that check.

Production SMTP requires a real sender; no credentials or paid service were invented. The public provider's duration/admission/privacy limits and absence of attendance telemetry remain. The development `braces@3.0.3` advisory has no published compatible patch at the time of this change; production dependency audit was clean during the review. No unsafe package override is introduced.
