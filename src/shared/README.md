# Shared contracts and validation

`contracts.ts` includes the implemented Phase 3–5 profile/current-user/skills/discovery/booking DTOs and design-only contracts for later phases. `validation.ts` provides strict runtime auth/profile/skills/booking/query input schemas and timezone conversion and the callback destination allowlist. Types alone do not authorize access; backend identity checks and database RLS/functions enforce ownership.

Keep shared imports provider-neutral and free of server-only code/secrets. Phase 3 database rows/types live under `src/backend/supabase`; safe DTOs omit private preferences/email from public profiles. Reputation is null/zero until feedback is implemented, not a simulated rating.
