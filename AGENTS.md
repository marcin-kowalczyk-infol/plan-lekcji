# Purpose and scope
Polish shared weekly lesson planner. GitHub Pages serves the frontend; Sites hosts a Cloudflare Worker and D1. Viewing requires the secret link; editing additionally requires the PIN. No automated holiday or fortnightly scheduling.

## Architecture
`public/` contains the dependency-free frontend. `worker.mjs` authenticates requests, validates input and performs version-checked D1 writes. `server.mjs` is the local Node/SQLite counterpart. Shared validation and legacy decoding live in `validate.mjs`. The JSON record contains events and five day-level escort names. Events may have their own escort name; the interface exposes it for the existing after-school section (start at or after 16:30).

## Commands
- `npm start`: local preview on 127.0.0.1:8787.
- `npm run init`: initialize local private data once from a private seed.
- `npm test`: access control, sessions, conflicts, validation and escort persistence.
- `npm run build`: stage Worker and migrations for Sites packaging.
- `npx drizzle-kit generate`: generate migrations only when the schema changes.

## Configuration
Local `DATA_DIR`, `HOST`, `PORT` control storage and listening. Production secret `PLAN_CONFIG` holds hashed access values and allowed origins. `public/config.js` selects the production API origin. `.openai/hosting.json` identifies the existing Site and logical D1 binding. Publish only `public/` to GitHub Pages. Preserve the current Site audience and existing project ID.

## Invariants
Never commit private data, credentials, plan contents, or tokens. Preserve PIN checks, five-attempt throttling, no-store/noindex, escaped user text and optimistic version checks. Read legacy arrays without rewriting existing data. Omitted escort fields preserve existing values for older clients; explicit empty strings clear them. Keep export/import inclusive of day-level and event-level names. Do not seed or reset production when updating the application.

## Logging and troubleshooting
Local startup logs one readiness line; Worker errors log a generic API failure without request data. Check GitHub Actions for frontend deployment and Sites deployment status for the API. Cross-origin failures usually indicate an outdated canonical API origin or an origin missing from PLAN_CONFIG. A 409 means another editor saved first; reload and retry. A 429 means the PIN retry window is active.

## Coding conventions
Use ESM and small functions; keep local and production API behavior aligned. Maintain current dependency and migration files. Record behavioral changes in README. Preserve all five days in the mobile full-week view: stacked in portrait, five columns in landscape from 600px. Keep the single-day view separate. Day shortcuts scroll without hiding other days. There is no multi-bot runtime.
