# Shared contracts

`contracts.ts` contains Phase 2 design DTOs for planned frontend/backend interfaces. These are compile-time types only: strings/numbers are not runtime validation, authorization, or money operations. Do not treat them as a live API. See `docs/API_CONTRACT.md` and `PROJECT_SPEC.md`; business defaults were selected under owner delegation.

Keep imports provider-neutral and free of server-only modules/secrets. UUIDs, UTC strings, integer units, and enums must be validated at the backend boundary. Derive database row types from actual migrations once available; do not expose private rows verbatim as DTOs.
