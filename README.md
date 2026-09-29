# Workout Planner

Workout Planner is a Tempo-aligned app for planning and following your own
training. The first MVP focuses on creating reusable workouts, scheduling them
in a Monday-based calendar, following sessions, and recording and reviewing
outcomes without needing a coach.

Coach collaboration is an existing secondary capability. Current development
prioritizes a complete, reliable personal workflow; see PRODUCT.md for MVP
scope and acceptance criteria.

## Documentation

Use these documents as the current source of project guidance:

- `AGENTS.md` - shared operating rules for coding agents.
- `CLAUDE.md` - short repository guidance for Claude-compatible tools.
- `ARCHITECTURE.md` - live routes, service ownership, data boundaries, and safe extension rules.
- `PRODUCT.md` - current product purpose, scope, and non-goals.
- `DESIGN.md` - current visual system used by the application and Impeccable.
- `docs/agent-workspace/CURRENT-STATUS.md` - verified implementation snapshot.
- `docs/agent-workspace/WORK-INDEX.md` - compact capability and ownership index.

Source code and tests are authoritative. The workspace contains current
coordination only; it is not an archive of old plans or decisions.

### Design Work

Use this order for interface work:

1. Read `DESIGN.md` for durable visual rules and reusable component patterns.
2. Read `app/globals.css` for the implemented semantic tokens and state colors.
3. Reuse owners in `components/ui.tsx`, `components/tempo/`, `AppShell`, and
   `WorkoutBuilder` before adding route-local styles.
4. Treat `app/design/*` as visual experiments only. They are not production
   screens and their tokens must not be copied into authenticated routes.

If code and `DESIGN.md` disagree, verify the code and tests first, then update
the design contract when the difference is a durable system rule.

## Local Setup

Use `pnpm`.

1. Copy `.env.example` to `.env`.
2. Set a real `AUTH_SECRET`, for example with `openssl rand -base64 32`.
3. Optionally set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` for Google OAuth.
4. In the project root `.env`, paste the Neon pooled PostgreSQL connection
   string into `DATABASE_URL` and the matching direct connection string into
   `DIRECT_URL`. Keep the surrounding quotes. The pooled host contains
   `-pooler`; the direct host does not. For a local PostgreSQL database, the
   same URL can be used for both values.
5. Run `pnpm db:migrate` to apply migrations without changing existing data.
6. Run `pnpm dev`.

For production credential password recovery, set `RESEND_API_KEY`, a verified
`PASSWORD_RESET_FROM_EMAIL`, and an HTTPS `AUTH_URL` in the server environment.
See `.env.example`; the Resend account must allow sending from that address.

For a fresh, disposable development database only, run `pnpm db:seed` after
the migration to create demo accounts. Seeding deletes existing application
data; it is not needed to fix the connection error.

## Strava Sync Setup

The Import page supports connecting a Strava account, reviewing
recent activities, previewing streams, categorizing the sport, matching an
unfinished planned session, and explicitly importing the result. Strava OAuth
tokens are encrypted at rest with `STRAVA_TOKEN_ENCRYPTION_KEY`; use a fresh,
random 32-byte key encoded as 64 hexadecimal characters and keep it server-only.

1. Register a Strava API application. Set `STRAVA_CLIENT_ID`,
   `STRAVA_CLIENT_SECRET`, and `STRAVA_TOKEN_ENCRYPTION_KEY` in the server
   environment. Set `STRAVA_OAUTH_REDIRECT_URI` to the full public callback URL
   ending in `/api/strava/callback` and register its domain with Strava.
2. Deploy the app or expose local development over a public HTTPS tunnel. Set
   `STRAVA_WEBHOOK_CALLBACK_URL` to the full public HTTPS URL ending in `/api/strava/webhook` and
   `STRAVA_WEBHOOK_VERIFY_TOKEN` to a separate random value.
3. Run `pnpm db:migrate`, then `pnpm strava:webhook`. The command creates (or
   finds) the single app-wide Strava webhook subscription and prints its ID;
   set that as `STRAVA_WEBHOOK_SUBSCRIPTION_ID` in the app environment.
4. Optionally set `STRAVA_WEBHOOK_WORKER_SECRET` and schedule authenticated
   `POST /api/strava/webhook-worker` requests to retry queued webhook events if
   background processing fails. Webhook delivery is acknowledged quickly and
   event work runs asynchronously.

Disconnecting in Tempo clears the connection and its imported Strava sessions,
then attempts to revoke the provider token. If Strava does not confirm
revocation, the page links to Strava's connected-app settings. Strava-side
authorization changes are received through the webhook.

Prisma CLI reads `.env`, so a database-only `.env.local` is not sufficient for
`pnpm db:push`, `pnpm db:migrate`, or `pnpm db:setup`. `DATABASE_URL` is the
pooled runtime URL; `DIRECT_URL` is used for Prisma migrations and
should not use Neon’s `-pooler` hostname.

## Neon and Vercel

1. Create a Neon project and copy both connection strings from the branch
   connection dialog.
2. Add `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) to the
   Vercel project for every environment where the app will run. Keep the
   direct URL out of client-side code.
3. Add the Auth.js variables from `.env.example`, then deploy. The Vercel
   build runs `prisma migrate deploy` before building the Next.js app.
4. Run `pnpm db:seed` only against a disposable development or preview branch;
   the seed script deletes existing application data before recreating demo
   accounts.

The PostgreSQL baseline migration creates a new Neon database from the current
schema. It does not convert the ignored legacy `prisma/dev.db` file; migrate
existing SQLite data separately before switching a production user base.

## Demo Accounts

The seed command creates these local accounts:

| Role | Email | Password |
|---|---|---|
| Coach | `coach@demo.local` | `demo1234` |
| Athlete | `mara@demo.local` | `demo1234` |
| Athlete | `jonas@demo.local` | `demo1234` |
| Athlete | `sofie@demo.local` | `demo1234` |

## Guided Workout Creator

Athletes can build an editable workout draft from four choices in Workouts:
sport, length, effort, and whether to use intervals. Tempo reads only their
completed sessions from the past 28 days to summarize recent training. A
server-side model call, when a model key is configured and its shared health
check succeeds, designs a complete workout with its own title and blocks. Tempo
validates sport, exact duration, block structure, zone limits, and cautious
limits for sparse same-sport history or a recent high-RPE session. If the model
is unavailable or returns an invalid draft, the creator chooses a validated
standard pattern and still opens a complete draft in the regular editor. The
form shows whether AI creation is available, and the editor identifies the
actual source of each draft. Saving to the workout library is
always a separate action. The model sees no names, notes, activity streams, or
raw performance profile values. OpenAI uses the built-in
`https://api.openai.com/v1/responses` URL; set `OPENAI_WORKOUT_MODEL` to override
its default model. A custom provider needs `WORKOUT_LLM_API_URL`,
`WORKOUT_LLM_API_KEY`, `WORKOUT_LLM_MODEL`, and `WORKOUT_LLM_API_FORMAT`. The
format can be `responses` or `chat-completions`; the endpoint must implement
that OpenAI-compatible request and response shape. A key alone cannot select
a custom provider. The custom provider's data handling terms apply.

The app stores only provider health status and a configuration hash in the
database. One probe is claimed across app instances, then reused for 15 minutes
when healthy or 2 minutes after failure. The health check uses a minimal model
request; normal workout creation uses one model request per generated draft.

## Commands

```bash
pnpm dev
pnpm test
pnpm lint
pnpm build
pnpm db:setup
pnpm db:push
pnpm db:migrate
pnpm db:seed
```

`pnpm db:migrate` applies committed migrations and is the command used during
Vercel builds. Use `pnpm db:push` only for local schema prototyping; it does not
create migration files. `pnpm db:seed` clears and recreates the demo data, so
do not run it against a production database.
