# API contract and future design

Phase 3 implements the auth endpoints below and `GET /api/v1/me`, `PATCH /api/v1/me/profile`, and `GET /api/v1/profiles/:userId`. Phase 4 also implements `GET /skills`, `GET/PUT /me/skills`, and `GET /discover` under `/api/v1`. Booking/wallet/video/feedback/community endpoints remain planned. Runtime auth/profile/skills/query schemas live in `src/shared/validation.ts`; later DTOs remain design contracts. Business rules reference the adopted MVP defaults in `PROJECT_SPEC.md`.

## Conventions

Profile and future business base path `/api/v1`; authentication paths are listed separately below. JSON request/response bodies; auth is a validated Supabase SSR session cookie, never a browser-supplied actor ID. Business/profile endpoints require authentication; auth entry points are public. Mutations require same-origin checks. Booking/meeting/financial actions also require verified email and completed onboarding. Return private responses with `Cache-Control: no-store` and do not log tokens.

Successful responses: `{ "data": T }`; lists: `{ "data": { "items": T[], "nextCursor": string | null } }`. Errors: `{ "error": { "code": ErrorCode, "message": string, "fieldErrors"?: { "field": ["message"] } } }`. Create returns 201, reads/updates return 200; no JSON-less successes. ISO timestamps are UTC ending in `Z`. UUID IDs and integer minute units are server-validated. Unknown fields are rejected. Strings are trimmed, comments/bios treated as plain text, request body limit 16 KiB excluding future provider operations.

Paginated reads accept `limit` (default 20, maximum 50) and an opaque `cursor`. Profiles/discovery use stable user ID order, catalogue uses slug, feedback uses `(created_at, id)` descending, bookings use `(starts_at, id)`, ledger uses `(created_at, id)` descending, leaderboard uses `(average, count, user_id)` descending/descending/ascending. Cursors encode validated tuple/filter context; they confer no access. Read only participant/owner-visible rows. Invalid cursor/filter/limit returns 400. A refreshed ranking may move between pages; no snapshot guarantee.

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Invalid fields, enum, cursor, date, duration or malformed JSON |
| 401 | UNAUTHENTICATED | No valid server-verified identity |
| 403 | FORBIDDEN / EMAIL_UNVERIFIED / PROFILE_INCOMPLETE | Actor is known but cannot perform this operation |
| 404 | NOT_FOUND | Missing or private entity inaccessible to this actor; avoid existence leaks |
| 409 | INVALID_STATE / SCHEDULE_CONFLICT / INSUFFICIENT_CREDITS / REQUEST_EXPIRED / ALREADY_REVIEWED / IDEMPOTENCY_CONFLICT | Authoritative business conflict; UI refreshes relevant data |
| 429 | RATE_LIMITED | Limit exceeded; include Retry-After |
| 502 | PROVIDER_UNAVAILABLE | Video/auth provider operation unavailable |
| 500 | INTERNAL_ERROR | Generic message; private diagnostic logged without credentials |

## Authentication — implemented in Phase 3

Auth uses Supabase SSR cookie helpers through Next.js route handlers. These public auth endpoints require configured Supabase/SITE_URL and same-origin JSON mutations; profile APIs independently validate authoritative identity with `getUser()` and verified email. `src/proxy.ts` uses `getClaims()` to refresh sessions and passes refreshed cookies/cache headers to the browser. No password store or trusted cookie-user authorization exists in the app.

| Method/path | Request | Response data |
| --- | --- | --- |
| POST `/api/auth/signup` | `{ email, password }` | 201 `{ verificationRequired, redirectTo: string|null }`; new passwords 8–128 characters; confirm email when required |
| POST `/api/auth/login` | `{ email, password }` | 200 `{ redirectTo: "/dashboard" }`; invalid credentials 401; unconfirmed email 403 |
| POST `/api/auth/logout` | `{}` | 200 `{ redirectTo: "/login" }`; signs out this session locally, not every other device |
| POST `/api/auth/resend` | `{ email }` | 200 `{ message }`; neutral confirmation response; provider throttling returns 429 |
| POST `/api/auth/google` | `{}` | 200 `{ redirectTo }` Supabase OAuth URL; 403 when disabled; actual provider configuration unverified |
| GET `/auth/callback` | `code`, optional `next` | PKCE exchange then 307 redirect; next allowlist: dashboard/profile/onboarding, default dashboard |
| GET `/auth/confirm` | `token_hash`, `type=email|signup` | OTP verification then 307 dashboard redirect; rejects replay/invalid tokens with generic login notice |

Callbacks reject unsupported/missing inputs, never echo tokens/provider errors, and redirect to the configured app origin. Auth mutation origins must match `SITE_URL` exactly. Mutations limit JSON to 16 KiB, reject unknown fields, and use Supabase's configured auth rate limits; 429 includes Retry-After. No custom distributed rate limiter is implemented. See `docs/SUPABASE_SETUP.md` for callbacks, template and optional OAuth configuration. Hosting must redact callback query strings from access logs; dev incoming request logs are disabled to avoid token logging.

Extra implemented errors: 401 `INVALID_CREDENTIALS`; 503 `CONFIGURATION_REQUIRED` for missing/invalid app configuration; 503 `DATABASE_UNAVAILABLE` for missing/unavailable profile storage. Invalid provider keys/URL connectivity can still require operator diagnosis; presence alone is not readiness. The public profile `reputation` is null average/zero count until Phase 8 introduces feedback.

## Profiles and skills

| Method/path | Request | Response data / authorization |
| --- | --- | --- |
| GET `/me` | None | `CurrentUser`: own public profile or null, private timezone and emailVerified |
| PATCH `/me/profile` | `{ displayName, bio, college, timezone }` | `CurrentUser`; creates onboarding profile once or updates self; no owner ID in input |
| GET `/profiles/:userId` | None | `PublicProfile`; onboarded members only; no email, timezone preference, credits or booking list |
| GET `/skills` | Pagination | `Page<Skill>`; enabled catalogue only |
| GET `/me/skills` | None | `SkillSelections`; self |
| PUT `/me/skills` | `{ offeredSkillIds: UUID[], wantedSkillIds: UUID[] }` | `SkillSelections`; atomically replace self selections; unique IDs; max 20 per direction; enabled catalogue IDs |
| GET `/discover` | Pagination; optional `skillId` | `Page<DiscoveryMatch>`; people offering at least one of caller's wanted skills, excluding caller; optional filter must be a wanted skill |
| GET `/community/leaderboard` | Pagination | `Page<LeaderboardEntry>`; server-computed aggregates only |

Profile validation: display name 2–60 characters, bio 0–500, college 0–120; valid IANA timezone required. Offered/wanted sets may overlap (one may teach basics and want more learning); no global account role. Catalogue seeding and changes are controlled migrations, not ordinary member writes.

## Bookings

| Method/path | Request | Response data / actor |
| --- | --- | --- |
| POST `/bookings` | `CreateBookingRequest`: `{ teacherId, skillId, startsAt, durationMinutes }` | 201 `Booking`; actor is learner; check teacher offering, specified timing/duration, holds and funds atomically |
| GET `/bookings` | Pagination; optional `state`, `role: teacher|learner` | `Page<Booking>`; participant only; expire actor's overdue pending requests first |
| GET `/bookings/:id` | None | `Booking`; participants only; expire if overdue first |
| POST `/bookings/:id/accept` | `{}` | `Booking`; teacher; pending/unexpired, before start |
| POST `/bookings/:id/reject` | `{}` | `Booking`; teacher; pending |
| POST `/bookings/:id/cancel` | `{}` | `Booking`; either participant, pending/accepted before start |
| POST `/bookings/:id/confirm` | `{}` | `Booking`; either participant after end; records independent confirmation; second settles |
| POST `/bookings/:id/dispute` | `{ reason }` (10–500 characters) | `Booking`; participant, accepted after start; stores private reason |
| POST `/bookings/:id/resolve` | `{ resolution: "complete" | "cancel" }` | `Booking`; participant, disputed; both same votes resolve; complete requires end passed |

`Booking` includes participant IDs, skill ID, start/end, duration, state, authoritative cost units, expiry, confirmation flags, optional participant-visible dispute reason/resolution votes, and created/updated timestamps. Public discovery never includes booking details. Changing skill selections does not invalidate an already requested/accepted session; new requests require the teacher's current offering.

Financial operations and scheduling become one atomic workflow in Phase 6. Phase 5 must clearly label reservations as not yet implemented and must not expose real paid bookings or claim a usable financial workflow before integration. No unauthenticated expiry/settlement endpoint is exposed: use trusted database routines invoked with verified actors and, if configured, a restricted scheduler.

## Wallet, feedback, and video

| Method/path | Request | Response data / authorization |
| --- | --- | --- |
| GET `/me/wallet` | None | `Wallet`: settled, reserved, available units; self only; expire relevant pending holds first |
| GET `/me/wallet/transactions` | Pagination | `Page<LedgerEntry>`; own entries, including one starter grant and signed transfers; never another user's ledger |
| GET `/me/wallet/reservations` | Pagination | `Page<Reservation>`; own active holds with booking ID and reserved units |
| POST `/bookings/:id/feedback` | `{ rating: 1..5, comment?: string }` | 201 `Feedback`; completed participant reviewing the other; unique booking/reviewer; no target ID input |
| GET `/profiles/:userId/feedback` | Pagination | `Page<Feedback>`; published feedback received by profile, readable by authenticated members |
| POST `/bookings/:id/meeting-access` | `{}` | `MeetingAccess`: short-lived opaque join token, room reference and expiry; accepted participant only, within the initial design window of 10 minutes before start through 15 minutes after end |

Meeting provider response mapping is provisional until Phase 7 chooses a provider. Browser receives participant join authorization only, never a provider API secret. Recheck current membership/state on every request; cancelled/completed/disputed bookings cannot issue new tokens. Limit grants to the remaining join window and provider-supported TTL. Already-issued token revocation and removal from a cancelled room must be evaluated with the provider; cannot promise immediate revocation before that evaluation.

## Idempotency and concurrent requests

`Idempotency-Key` UUID header required on POST booking creation, feedback creation, and booking state mutations. Scope by verified actor + operation + resource + key. Persist normalized input and result in a private idempotency table in the same database transaction as mutation. Same key/input replays the original successful result without another grant/hold/transfer/review; different input returns 409 IDEMPOTENCY_CONFLICT. Replays still validate actor access and must never issue expired meeting tokens; meeting access uses no durable replay token. Retain successful MVP keys for audit instead of premature expiry. Failed transactions leave no partial effect or success record. Natural uniqueness constraints additionally prevent repeat confirmations, starter grants, and settlements even when clients send a new key.

Clients refresh after stale replay responses; replay response is the original snapshot, not guaranteed current booking state. Independent attempts to accept an accepted request return INVALID_STATE; duplicate own confirmation on an accepted or completed session can return the current authorized booking with no effect. Terminal mutation attempts otherwise return INVALID_STATE. Overdue pending requests transition to expired before returning REQUEST_EXPIRED from attempted actions. Business expiry must commit even if the route subsequently responds with a conflict; return a typed database outcome rather than raising an exception that rolls back the cleanup.

## Representative example (planned, not live)

```http
POST /api/v1/bookings
Content-Type: application/json
Idempotency-Key: 5a3d0e47-f667-4b97-80f1-eac9178acd81

{"teacherId":"4be5c87c-b624-4437-b43a-7005c5b730d6","skillId":"7f217c64-76b9-42f0-86e8-2420b4656319","startsAt":"2026-11-01T08:30:00Z","durationMinutes":60}
```

Success data contains the server-created booking with `state: "pending"`, `costUnits: 60`, computed end and request expiry. No learner ID, balance, completion claim, reputation value or room secret is accepted from the browser.

## Required implementation checks

Phase 3 verified locally: two accounts, invalid/forged identity, confirmation replay, owner-only saves and direct-write denial. Hosted/Google checks remain unrun. Phase 4: catalogue constraints and deterministic matching. Phase 5: state matrix, both-role overlaps, half-open boundaries and concurrent requests. Phase 6: concurrent spending, repeat starter/completion, expiry/cancellation races and ledger conservation. Phase 7: participant-only tokens, expiry and smartphone permissions. Phase 8: ineligible/duplicate/self feedback and aggregate accuracy. These tests are planned, not executed in Phase 2.

## Phase 4 implementation details

Catalogue order is slug ascending; discovery order is user UUID ascending. Both return `{ items, nextCursor }` with default limit 20, max 50. Cursors contain a validated base64url tuple: catalogue last slug/enabled context, or discovery last UUID/current user/filter context. Malformed, repeated or unknown parameters and mismatched cursor/filter/user contexts return 400. Cursors are navigation aids, not authorization. Changes to selections between page reads may change results.

`PUT /me/skills` accepts only the two ID arrays. Each allows 0–20 unique enabled catalogue UUIDs; a skill may be both offered and wanted. Verified email and completed profile are required. Writes replace both arrays atomically and serialize by account; database rejection leaves previous selections intact. `GET /me/skills` returns empty arrays before onboarding. Discovery requires onboarding, excludes self, returns only matching offered skills in slug order, and validates an optional filter against the caller's enabled wanted skills. No wanted skills produces an empty page. No booking or financial endpoints are enabled.
