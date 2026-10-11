# SkillSwap administration

The owner authorized the admin extension and a demo-only account on 2026-10-11. Open `/admin` after signing in with an explicitly provisioned administrator. Admin navigation is shown only to current admins. Page and API guards verify Auth identity and database membership; JWT user metadata does not grant privileges.

## Management

- Overview: member, administrator, suspension, booking, dispute, catalogue and hidden-feedback counts.
- Members: search by name/email, inspect real total/reserved minute units, suspend/restore, grant/revoke administrator access. Admins must be demoted before suspension; self-suspension and removal of the last admin are denied.
- Skills: add a validated name/slug/category and enable/disable catalogue entries. Existing bookings and skill history are preserved.
- Bookings/disputes: inspect participants, schedule, funding state and dispute reasons; record staff review notes. These notes do not resolve a dispute or transfer credits. Restore suspended participants so they can finish an existing exchange.
- Feedback: hide/restore public reviews with an audit reason. Hidden reviews no longer contribute to member-visible reputation; their authors can still inspect the preserved original from their booking. Stars/comments are never rewritten.
- Audit: read who changed what, when, why, and the previous/resulting state. All changes require a 10–500-character reason and a UUID retry key. Successful identical retries return the same audit result; changed payloads conflict. Audit rows are immutable.

The panel has no arbitrary wallet edits, forced settlement, account deletion, impersonation or access to private meeting links/provider credentials. Suspend/restore preserves funds and bookings. Suspensions block server APIs, direct member RPC writes and exposed table reads; suspended profiles are hidden from discovery. Existing downloaded data cannot be recalled, but revoked admin membership is checked on every subsequent privileged operation.

## Trusted bootstrap

Apply the two admin migrations through the existing authorized hosted migration workflow before deploying the updated app. Do not modify previously applied migrations.

For an existing verified, onboarded owner account:

```sh
npm run admin:bootstrap -- --email YOUR_EXISTING_ACCOUNT_EMAIL
```

Replace the placeholder. For the explicitly authorized demo-only identity:

```sh
npm run admin:bootstrap -- --demo
```

This creates `admin@skillswap.example` using the trusted Auth provisioning API, with a random password and explicit confirmation of this demo identity only. `.example` cannot receive real email. The normal onboarding RPC issues only the usual one-time starter grant; ordinary signup confirmation stays enabled. The account-management key exists only in the provisioning process and is never stored or deployed. Login details are saved to ignored `.local/demo-admin-credentials.txt` with mode 600. Never commit or upload that file. The bootstrap is an owner operation, not an HTTP endpoint; normal users cannot invoke it through SkillSwap.

The helper preserves existing identities/passwords rather than resetting them. Keep access to the owner workspace/private credentials file restricted. Replace the demo administrator with a real owner account before broader use.

## Google sign-in

The Google button is always visible. The server reads Supabase's actual public provider settings for every login/signup page and Google launch request. It is disabled with an explanation until Google is enabled; a stale `GOOGLE_AUTH_ENABLED` environment flag no longer hides it. Provider/network failure leaves email/password available and gives a useful status.

Create a Google Cloud OAuth **Web application** client and consent screen. For this deployment, use:

- App origin: `https://skillswap-delta-taupe.vercel.app`.
- Google authorized redirect URI: `https://avunxagyeywvfjhhowqk.supabase.co/auth/v1/callback` (Supabase receives Google's response).
- Supabase allowlisted app callback: `https://skillswap-delta-taupe.vercel.app/auth/callback` (the app exchanges the PKCE code).

Use only basic identity scopes. If the Google consent screen is in testing mode, add the actual demo accounts as test users. Configure the client ID/secret in Supabase Authentication → Sign In / Providers → Google. Alternatively, securely supply `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in the cloud environment and run `npm run google:configure`; the secret is scoped to `api.supabase.com` and is never part of the deployed application.

Once the provider is configured, the live button becomes available without a redeploy. Google-only signup/login does not require custom SMTP, because Supabase handles the verified Google identity. Email/password confirmation for ordinary students still requires SMTP. Real Google account selection, redirect/cookie handling and onboarding must be tested before calling Google sign-in complete. Google Meet links remain a separate feature.
