# Setup and operations

Canonical runbook for setup, database deployment and optional integrations.
`package.json`, `.env.example` and service code define commands and environment
names. Never copy real secrets into tracked documentation.

## Install and commands

Use Node.js compatible with Next.js 16 and the Node test runner's
`--experimental-strip-types`; Node 24.8.0 was used in earlier verification.
The repository does not yet enforce an engines range. Use pnpm pinned by
`package.json` (currently 10.26.0). First run `pnpm install --frozen-lockfile`.

| Command | Effect |
|---|---|
| `pnpm dev` | Generate Prisma Client and start Next.js |
| `pnpm test` | Run Node source/service and architecture tests |
| `pnpm lint` | Run full ESLint |
| `pnpm build` | Ensure Prisma Client, **deploy database migrations**, build Next.js |
| `pnpm start` | Serve existing production output |
| `pnpm db:migrate` | Apply committed PostgreSQL migrations |
| `pnpm db:push` | Prototype local schema without creating migrations |
| `pnpm db:seed` | **Delete application data**, then create demo data |
| `pnpm db:setup` | Apply migrations and run destructive seed |
| `pnpm strava:webhook` | Create/find app-wide Strava webhook subscription |

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
4. Set `STRAVA_WEBHOOK_WORKER_SECRET` and schedule authenticated
   `POST /api/strava/webhook-worker` requests (for example every minute), with
   `Authorization: Bearer <STRAVA_WEBHOOK_WORKER_SECRET>`, to retry queued events
   while users are away. Webhook delivery is acknowledged quickly and event
   work runs asynchronously. Workers claim a two-minute lease and retry failures
   with backoff from 30 seconds to one hour; interrupted work is recoverable.

The signed-in shell checks the local Strava inbox on entry, every 15 seconds
while visible, and on focus. This does not poll the Strava API. New activities
open a review dialog where users can complete an unfinished planned session,
add a standalone completed session, or **Discard for now**. Discard records
inbox state only: it never deletes a recorded or imported activity. **Review
later** acknowledges the current batch and leaves it available on Import.
Discarded items stay on Import with **Restore to notifications**, even when
they age out of the recent 100-activity provider page. Manual sync and webhook
updates preserve these choices. Imported activities are excluded from new
notifications. Returning users also recover due queue work for their own
connection; a worker schedule is still needed for retries while nobody is open.

Apply the notification migration before deploying this UI (`pnpm db:migrate`).
Verify the public callback challenge, create an activity in a connected Strava
account, then check the popup and planned-session/standalone outcomes. No new
storage allowance or retention deletion is implemented by this feature.

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


## Environment troubleshooting

- Windows app processes can lock Prisma's engine DLL. Stop the relevant local
  process before regenerating; do not reset a database to resolve a file lock.
- Prior checks with intact dependencies used
  `pnpm_config_verify_deps_before_run=false` to bypass pnpm's reinstall preflight.
  Install/restore dependencies if the tree is actually incomplete.
- `pnpm exec next build --webpack` checks the bundle separately from migrations.
  Using an existing Prisma Client does not verify generation or deployment.
- Builds need access to the configured Google font. A temporary system-font
  substitution does not verify the unmodified production build.

Use [verification](VERIFICATION.md) for acceptance and
[current status](agent-workspace/CURRENT-STATUS.md) for evidence/open gates.
