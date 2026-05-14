# Think Together Training MVP

Production MVP for Think Together PBIS program induction training. The app is a Vite/React frontend backed by an Express API and PostgreSQL. The API owns authentication, training content reads, learner progress, scenario scoring persistence, and admin dashboard/export data.

## Runtime Shape

- Web app: Vite dev server on `http://127.0.0.1:5173`
- API: Express server on `http://127.0.0.1:5174`
- Database: PostgreSQL database named `think_training_mvp` by default
- Auth: bearer token sessions stored in PostgreSQL
- Migrations: Alembic owns the production migration chain; API startup also runs the legacy idempotent runner as a compatibility bridge
- Seed behavior: API startup upserts seeded content plus the configured admin account

The API currently binds to `127.0.0.1`. In production, place it behind the hosting platform router or a reverse proxy on the same host/network.

## Required Environment

Copy the sample file and fill in real values:

```sh
cp .env.example .env
```

Environment variables:

| Name | Required | Example | Notes |
| --- | --- | --- | --- |
| `API_PORT` | No | `5174` | API listen port. Defaults to `5174`. |
| `DATABASE_URL` | Yes | `postgresql:///think_training_mvp` | PostgreSQL connection string used by the API. |
| `CORS_ORIGIN` | No | `http://127.0.0.1:5173` | Exact frontend origin allowed to call the API with credentials. |
| `SESSION_TTL_HOURS` | No | `12` | Bearer session lifetime in hours. |
| `ADMIN_EMAIL` | Yes | `admin@thinktogether.local` | Login email for the seeded admin user. |
| `ADMIN_PASSWORD` | Yes | generate a unique secret | Startup upserts this password for `ADMIN_EMAIL`; rotate before any shared environment. |
| `TEST_DATABASE_URL` | Tests only | `postgresql:///think_training_mvp_test` | Used by API tests when present. |

Do not commit `.env` or real credentials. Use the deployment platform secret manager for production values.
The local npm scripts source `.env` through the shell, so wrap values in single quotes if they contain spaces or shell metacharacters.

## Local PostgreSQL Setup

Install and start PostgreSQL, then create the local databases:

```sh
createdb think_training_mvp
createdb think_training_mvp_test
```

If your local PostgreSQL requires an explicit user or password, set:

```sh
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/think_training_mvp
TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/think_training_mvp_test
```

The API creates tables automatically on startup. The test suite resets only the test database through the app test harness.

## Database Migrations

Alembic is configured in `alembic.ini` with a complete linear chain:

```text
001_foundation -> 002_identity_columns -> 003_completion_records -> 004_invite_revocations -> 005_feedback_guard -> 006_admin_audit
```

Use Alembic for production and shared environment schema changes:

```sh
npm run db:heads
npm run db:upgrade
npm run db:current
```

The expected single head is `006_admin_audit`. The Alembic migrations are idempotent against the existing local database and also bridge the legacy `schema_migrations` table, so this project should not be stamped manually.

## Local Development

Install dependencies:

```sh
npm ci
```

Create `.env` from `.env.example`, set a local admin password, then start the web and API processes:

```sh
npm run dev
```

Default local admin account, based on your `.env`:

- Email: value of `ADMIN_EMAIL`
- Password: value of `ADMIN_PASSWORD`

For a disposable local password you can use `ThinkTogether!2026`, but production and shared review environments must use a newly generated secret.

## Production Runbook

1. Provision PostgreSQL and create the production database.
2. Configure `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGIN`, `SESSION_TTL_HOURS`, and optionally `API_PORT` in the platform secret/config store.
3. Set `CORS_ORIGIN` to the deployed frontend origin exactly, for example `https://training.thinktogether.org`.
4. Install dependencies and build the frontend:

```sh
npm ci
python3 -m pip install -r requirements.txt
npm run db:upgrade
npm run build
```

5. Start the API:

```sh
npm run start:api
```

6. Serve the generated `dist/` frontend through the platform static host or a reverse proxy, with `/api` routed to the API process.
7. Log in once with `ADMIN_EMAIL` and `ADMIN_PASSWORD`, verify the seeded dashboard, then rotate the admin password if the value was shared during deployment.

Current note: the API runtime is TypeScript executed by `tsx`, so production installs must include dev dependencies unless the deployment pipeline adds a separate server compilation step.

## API Endpoints

Public:

- `GET /api/health` - health check and content version
- `POST /api/auth/login` - body `{ "email": "...", "password": "..." }`; returns bearer token, expiry, and user
- `POST /api/auth/accept-invite` - body `{ "token": "...", "password": "..." }`; redeems a one-time learner invite, creates the learner user session, and returns the learner profile

Authenticated:

- `POST /api/auth/logout` - deletes the current bearer session
- `GET /api/me` - current user profile
- `GET /api/learning-paths/:pathId` - seeded training path, modules, checks, and scenarios
- `GET /api/progress` - current learner progress and practice submissions
- `POST /api/progress/module-complete` - body `{ "moduleId": "..." }`; persists progress and returns a completion record once all required modules for the path are complete
- `POST /api/knowledge-checks/:itemId/answer` - body `{ "selectedAnswer": "..." }`
- `POST /api/scenarios/:scenarioId/score` - body `{ "response": "20 to 4000 chars" }`

Admin only:

- `GET /api/admin/dashboard` - KPI, readiness, and cohort data
- `GET /api/admin/learners` - learner roster with cohort and assigned path metadata
- `POST /api/admin/learners` - create learner and enroll them into a cohort
- `POST /api/admin/learners/:learnerId/invite` - generate or resend a one-time invite link for a learner; existing pending invites are revoked, plaintext token is returned once, and only the hash is stored
- `POST /api/admin/learners/:learnerId/invite/revoke` - revoke all pending invites for a learner
- `GET /api/admin/cohorts` - cohort list with facilitator/path IDs and learner counts
- `POST /api/admin/cohorts` - create a cohort for one or more training paths
- `GET /api/admin/exports/clearance.csv` - learner clearance CSV export
- `GET /api/admin/exports/completions.csv` - completion, invite status, score, practice, and LMS handoff CSV export

Authenticated requests use:

```http
Authorization: Bearer <token>
```

## Database Notes

- `schema_migrations` records applied migrations by ID and timestamp.
- `completion_records` stores durable PBIS completion receipts with confirmation code, score, content version, and LMS export flags.
- Progress, knowledge attempts, practice submissions, and completion records are linked to authenticated `users`; learner users are linked back to admin roster rows through `users.learner_id`.

## Deployment Hardening Checklist

- Use a managed PostgreSQL instance with encrypted storage, backups, restore testing, and connection limits sized for the API pool.
- Store all secrets outside the repository; rotate `ADMIN_PASSWORD` after initial production verification.
- Set `CORS_ORIGIN` to one exact HTTPS frontend origin. Do not use wildcards.
- Terminate TLS at the platform edge or reverse proxy, and route `/api` to the local API process.
- Run the API behind process supervision with restart policy, structured logs, and health checks against `/api/health`.
- Restrict database network access to the API runtime only.
- Confirm `SESSION_TTL_HOURS` matches the production session policy.
- Validate `npm run lint`, `npm run test`, and `npm run build` in CI before deploy.
- Add monitoring for login failures, 5xx responses, database connection errors, and disk/backup health.
- Plan a server build step before switching production installs to `npm ci --omit=dev`, because the current API start command uses `tsx`.

## Useful Commands

```sh
npm run dev          # API + Vite web dev servers
npm run dev:api      # API only, loading .env when present
npm run dev:web      # Vite web only
npm run start:api    # API only for deployed runtime
npm run lint         # ESLint
npm run test         # Vitest
npm run build        # TypeScript check + frontend build
```
