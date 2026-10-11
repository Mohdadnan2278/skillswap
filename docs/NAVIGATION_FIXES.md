# Navigation and theme release

## Why the live site had no theme control

The public home page still had no `Color theme` control when checked for this task. Vercel's canonical alias was serving deployment `dpl_67e2bxdGytmLjsDNoWQX6FbYa5pU`, source `69b77dc88186ca9c046459efeb62c8080af5084b`. The owner had merged the theme work into `main` (`47bdcff`), but a Git merge does not update this project's deployment.

The fixes are on `navigation-fixes`, based on that merged main. No production database change or deployment has been performed for this task.

## What changed

- The header visibly labels the Light/Dark/System selector **Theme**. The choice still persists, follows device preferences when System is selected, and synchronizes between tabs. Public, authentication and member headers wrap on small phones.
- All application hyperlinks have the shared primary or secondary button styling, with at least a 44-pixel touch target, visible keyboard focus and a real destination. Navigation keeps native anchor semantics, browser Back, keyboard activation and open-in-new-tab behavior. Buttons that submit or change data remain buttons.
- The dashboard includes **View bookings**, **View wallet** and **View notifications** shortcuts. The Bookings menu, history, booking cards, reservation entries, ledger entries and inbox all expose visible booking buttons.
- Discovery/profile/request links, filters, pagination, reset links, call return links, provider launch links, auth links and admin navigation use the same styling.
- Secondary buttons explicitly set their label color. This keeps a link readable when placed in a colored card that inherits white text.
- Missing and inaccessible pages now have theme-aware recovery buttons. Private booking/member/admin failures use neutral wording; account-load errors also offer a dashboard button.
- Existing call placement, scheduled completion, participant checks, credit terms and settlement rules remain in place.

## Verification

`tests/integration/navigation.spec.ts` adds six browser journeys:

1. Home/auth links and section anchors at 320 and 1280 pixels, visible theme changes and anonymous redirects.
2. Every member menu destination, active state, mobile menu closing/Escape, dashboard shortcuts, availability actions and sign out, in both themes on desktop and mobile.
3. Discovery to profile/request; booking list/detail; teacher acceptance from an inbox link; wallet reservation to booking; call/provider and return navigation; notification read actions; mutual completion; ledger to completed booking; history/wallet/inbox pagination; invalid-filter reset links.
4. All eight admin sections and invalid-filter reset navigation on mobile and desktop. Admin roles are explicitly granted only in the isolated local test database.
5. Checked Meet and Jitsi links actually opening the expected destination in a separate browser tab, device-check controls and leaving the call.

6. Unknown public routes and invalid/private booking/member/admin routes offer recovery without revealing private session details.

The tests check rendered link styling, nonempty destinations, touch-target height, label visibility, overflow and unexpected runtime page errors. They use isolated local Auth/PostgreSQL and create no hosted accounts or artificial hosted balances. External provider pages and the Jitsi SDK are explicitly labelled fixtures: these checks verify navigation and call controls, not live media or Google consent.

The initial focused navigation suite passed all five cases. Unit tests passed all 39 cases; `npm run check` passed lint, generated route types, TypeScript and the production build. The full regression run passed 40 of 41 cases; the remaining assertion expected the old default missing-member text. Updating it to verify the new recovery screen and dashboard button passed its focused rerun. The final five-case run passed the new missing/private-page recovery journey, both admin cases, Start-now call navigation and the updated skills UI case. Across the full and focused runs, all 42 distinct browser cases have passing results.

All 72 source hyperlink templates have real destination attributes and explicit button styling. Mobile/desktop screenshots were reviewed, including the existing call-frame continuity and completion placement check. Start-now diagnostic screenshots retain the native caret rather than injecting a temporary style during hydration; the focused rerun produced no hydration warning.

## Release prerequisites and recovery

The read-only production readiness check confirms the canonical origin, hosted project health, confirmed-email requirement, Google provider and exact Auth callbacks. Hosted production retains the original 12 app tables and has not received the two upgrade migrations. The new application source includes the already merged product upgrade; deploying it before applying those migrations would break booking lists, availability and notifications.

For the full release, use the reviewed procedure in [PRODUCT_UPGRADE.md](PRODUCT_UPGRADE.md): apply only `20261011150000_product_upgrade.sql` and `20261011150100_booking_list_views.sql`, configure the restricted named pending-request expiry job, retain Google configuration, and keep email signup/recovery disabled until SMTP is tested. Deploy the reviewed source on the existing free Vercel project with `SITE_URL=https://skillswap-comm.vercel.app` and verify the canonical alias. Repository instructions require authorization before merge, deployment or cloud database changes.

Keep the original READY deployment and `demo-working-2026-10-11` tag for recovery. If a release check fails, return the canonical alias to the retained compatible demo deployment; never reset ledger data, migration history or existing balances. Additive upgrade tables can remain for that application rollback. See the upgrade guide for the named scheduler rollback.

Live Google consent, real camera/microphone media and a new hosted two-person transfer require real participants. Automated local checks do not establish those results.
