# Frontend

Reusable Phase 3 UI lives in `components`: auth shell/form, profile form, logout control, and landing page. Routes and server-loaded identity live in `src/app`; server business operations live in `src/backend`.

Client forms call the implemented same-origin JSON endpoints and display pending, validation, connection error, confirmation, and saved states. No provider secrets or fake balances enter frontend modules. Future skill/booking/video screens are planned in `docs/UI_PLAN.md`, not available yet.
