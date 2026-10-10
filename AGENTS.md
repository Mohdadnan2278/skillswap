# Collaboration rules

- The assistant owns frontend and backend, following the project owner's phase instructions. Preserve prior contributions.
- Work one phase at a time. Verify and report the current phase, then wait for the owner before starting the next phase.
- Create a short task branch for each change and open a pull request targeting `main`.
- Push only with explicit authorization; never merge, deploy, provision paid resources, or alter cloud databases without authorization.
- Use npm and preserve `package-lock.json`. Node 24 is the development runtime.
- Keep Next.js routes in `src/app`, UI in `src/frontend`, server operations in `src/backend`, and shared contracts in `src/shared`.
- Keep database migrations in `supabase/migrations` when introduced. Document contracts and progress in `docs`.
- Validate inputs and authorization on the server. Never trust client financial or reputation values.
- Follow `PROJECT_SPEC.md` MVP defaults and the design documents in `docs/`; record any change to financial or scheduling rules before implementing it. Shared design DTOs are not runtime validators or deployed API claims.
- Coordinate changes to shared configuration, dependencies, and types; document them in the phase report.
- Never commit secrets, local environment values, `.local/`, or generated output.
- Run `npm run check` and a functional page smoke check for foundation changes.
- Inspect existing changes and preserve unrelated work. Use the existing isolated checkout; do not create a worktree unless requested.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
