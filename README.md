# SkillSwap

A student skill-exchange semester project. Phase 1 provides a responsive landing page only. Authentication, matching, bookings, credits, video, and reputation are not implemented.

## Development

Use Node 24 (`nvm use` if available) and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the development server on port 3000. No credentials or environment variables are required for Phase 1. `.env.example` documents configuration; keep real values in ignored `.env.local`.

```sh
npm run lint
npm run typecheck
npm run build
# Or all three:
npm run check
# Serve a successful production build:
npm start
```

If the machine's default npm cache is unwritable, append `--cache /tmp/skillswap-npm-cache` to installation commands. A production page request should return HTTP 200 and include the landing page heading and development notice. These checks do not validate future features.

## Structure

- `src/app/`: Next.js App Router entry points and global styles; future HTTP route handlers.
- `src/frontend/`: reusable UI components.
- `src/backend/`: future server business operations.
- `src/shared/`: compile-time design contracts for the planned API.
- `docs/`: API/database design, UI plan, and phase progress.
- `supabase/migrations/`: added when database implementation begins.
- `.local/PROJECT_PROMPT.txt`: local source prompt, ignored by Git.

One Next.js application hosts frontend and backend; separate services are unnecessary for this demo.

## Deployment

Vercel is the planned host. Use the Next.js preset, `npm run build`, and the repository root. No deployment has been performed; deployment requires owner authorization. Supabase and video provider configuration will be documented in their implementation phases.

## Phases

See [PROJECT_SPEC.md](PROJECT_SPEC.md), [API contract](docs/API_CONTRACT.md), [database design](docs/DATABASE_SCHEMA.md), [UI plan](docs/UI_PLAN.md), and [progress](docs/PROGRESS.md). Phase 2 documents planned features and MVP defaults selected under owner delegation. These documents and shared types do not mean feature endpoints or tables exist. Implementation proceeds one authorized phase at a time.
