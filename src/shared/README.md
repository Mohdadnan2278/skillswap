# Shared contracts and validation

`contracts.ts` includes the implemented Phase 3–5 profile/current-user/skills/discovery/booking DTOs and design-only contracts for later phases. `validation.ts` provides strict runtime auth/profile/skills/booking/query input schemas and timezone conversion and the callback destination allowlist. Types alone do not authorize access; backend identity checks and database RLS/functions enforce ownership.

Keep shared imports provider-neutral and free of server-only code/secrets. Phase 3 database rows/types live under `src/backend/supabase`; safe DTOs omit private preferences/email from public profiles. Reputation is null/zero until feedback is implemented, not a simulated rating.

Phase 8 adds teacher-managed Google Meet links, completed-session feedback, server-derived reputation and the community leaderboard. Video/feedback modules follow the existing backend/frontend/shared boundaries; no provider secret or editable score is exposed.
