# Backend

Phase 3 is implemented: Supabase SSR client/schema types, authoritative session guards, runtime configuration, HTTP input/error helpers, and profile service. Next.js HTTP handlers in `src/app/api` delegate to this layer. Authentication callbacks are in `src/app/auth`; session refresh runs in `src/proxy.ts`.

Server modules import `server-only`. Never import these into frontend modules. The app uses only the public Supabase key plus the user's verified cookie session; no service-role key is used. Owner-only writes run through `save_my_profile`, whose migration enforces its actor/verification checks independently of the HTTP handler. Financial/scheduling/video behavior is not implemented.
