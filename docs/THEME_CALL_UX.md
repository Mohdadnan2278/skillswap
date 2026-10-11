# Themes and session controls

This update preserves the existing SkillSwap wordmark, emerald palette and core booking flow. The approved colorful banner is used in the README. Website styling adapts to light and dark environments without introducing a new brand or changing session costs, timing, permissions or settlement rules.

## Appearance

- The header on public, authentication and member screens offers **System**, **Light** and **Dark**.
- System follows the device setting and responds to changes while the page is open.
- A preference is stored under `skillswap-theme` in browser storage, survives navigation/reload and synchronizes between tabs on the same origin. If storage is unavailable, switching still works for the current visit.
- A fixed inline script applies a validated preference before first paint. The root hydration warning is suppressed only for the theme attribute that this script changes; page content is still checked normally.
- Shared Tailwind color tokens adapt surfaces, fields, secondary text, warnings, selection states and borders. Light mode retains the emerald/off-white palette. White text on the existing emerald hero panels and primary buttons stays white.
- Controls retain visible keyboard focus and touch targets. Brief color transitions respect reduced-motion preferences. No remote font, theme library or new package is required.

## Session and call flow

1. Booking controls are placed ahead of the participant, schedule and policy details. Pending accept/reject/cancel actions are also easier to reach.
2. Accepted funded bookings show a compact server-aligned countdown. The end boundary triggers a page refresh to obtain authoritative available actions; the clock itself cannot authorize completion.
3. The call screen places a provider choice and device preview before explanatory notes. Jitsi starts as the selected option; switching to Meet makes its setup and launch controls the main workspace.
4. Joining Jitsi scrolls its responsive embedded frame into view. A running Jitsi call must be left before switching providers. Switching away from a pre-join preview unmounts it and stops its media tracks.
5. At the scheduled end, a compact completion panel stays at the top while viewing the call. Each participant can confirm there, or use the controls at the top of the booking page. An already-confirmed participant sees that the other confirmation is still needed.
6. A server refresh updates the completion panel without recreating the Jitsi frame. Confirmation still uses the existing authenticated, idempotent booking endpoint. A completed booking stops exposing call eligibility and displays the recorded settlement result.
7. A checked Meet launch link is placed ahead of setup instructions. Public Jitsi access limits, external Meet access and the distinction between scheduled time and actual attendance remain explained.
8. Completed standard bookings put feedback ahead of the longer details. Request review panels and admin confirmation forms move into view after explicit user actions; keyboard focus follows the new panel or reason field. Dispute reporting is expandable so its textarea does not bury the primary session action.

## Validation

The dedicated `tests/integration/theme-call-ux.spec.ts` exercises system changes, explicit preferences, reload/navigation, cross-tab synchronization, denied storage, reduced motion, 320px public pages and member screens at 320/390/768/1280px in both themes. It also checks that the call frame stays mounted as server-approved completion becomes available, and verifies the two-person 0.5-credit ledger settlement.

The call placement check uses an explicitly labelled browser adapter fixture, and its short end boundary is a local database fixture. These prove frontend behavior and real local API/ledger rules; they do not prove a live Jitsi media connection or actual attendance. Existing Jitsi permission/leave/rejoin, Google Meet link, mobile authentication, booking, feedback and credit tests cover adjacent behavior. Public provider interfaces control their own appearance.

Run checks with Node 24 and the existing npm lockfile:

```sh
npm test
npm run check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:integration
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npx playwright test theme-call-ux.spec.ts auth-ui.spec.ts bookings-ui.spec.ts skills-ui.spec.ts meetings-ui.spec.ts credits-ui.spec.ts demo-workflow.spec.ts
```

Browser tests load only the repository's isolated local Supabase configuration. They must never create accounts or adjust booking clocks on hosted Supabase.

## Release and recovery

The UI is prepared on `theme-call-ux`, based on the current merged `main`. This change adds no database migration, dependency, environment key or financial rule. Existing upgrade requirements from `main` still apply: follow [PRODUCT_UPGRADE.md](PRODUCT_UPGRADE.md) and [DEPLOYMENT.md](DEPLOYMENT.md) before releasing that source. Pushing the branch does not deploy the live site.

The preserved working demo tag `demo-working-2026-10-11` and backup branch remain available. For production rollback, retain the current friendly-origin configuration and follow [FRIENDLY_URL.md](FRIENDLY_URL.md); promoting a deployment built for the old hostname alone can produce an origin mismatch.
