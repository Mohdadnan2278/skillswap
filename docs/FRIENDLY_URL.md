# SkillSwap production address

The canonical address is **https://skillswap-comm.vercel.app**. The old `skillswap-delta-taupe.vercel.app` address redirects with HTTP 307, preserving the requested path and query. Sign in again on the new address because browser cookies belong to their original hostname.

The owner authorized the shorter URL on October 11, 2026. Vercel deployment `dpl_67e2bxdGytmLjsDNoWQX6FbYa5pU` is READY and uses the exact preserved demo application source `69b77dc88186ca9c046459efeb62c8080af5084b`. Only the canonical origin changed; no upgrade code or new database migration was released. The project remains on Hobby.

Production `SITE_URL` and Supabase Auth Site URL point to the new origin. Existing callback allowlist entries are retained, with the exact new `/auth/callback`, `/auth/confirm` and `/auth/recovery` entries added. Google credentials, confirmation policy, accounts, bookings, demo settings and balances were preserved. The Google Cloud redirect remains the same Supabase Auth callback because the Supabase project has not changed.

Vercel confirms domain ownership, the deployment source and readiness. The old URL's redirect is verified from this workspace. Direct HTTP verification of the new hostname is blocked by the cloud environment's current network allowlist; add/publish the saved new-hostname rule before claiming live sign-in/media testing from this workspace.

## Rollback and future deployment

The original production source is pushed as tag `demo-working-2026-10-11`, with merged-release backup branch `demo-backup-2026-10-11`. To restore this working demo while retaining the friendly address, promote **`dpl_67e2bxdGytmLjsDNoWQX6FbYa5pU`**, whose captured configuration uses the new origin. Keep the current exact callbacks and old-domain redirect. Alternatively rebuild the tag with `SITE_URL=https://skillswap-comm.vercel.app`.

The older deployment `dpl_7NEQd9BRtTTfCYPTkZ8KFMfXTTqx` captured the old origin. Promoting it alone does not update its `SITE_URL`; restoring the old address requires deliberately reverting the domain redirects and Supabase Site URL as well. Never reset ledger data, accounts, balances or applied migration history for an application rollback.

The separate `product-upgrade` branch remains unreleased. Use the new origin for its eventual deployment and recovery configuration, and retain the friendly-address demo deployment for rollback.
