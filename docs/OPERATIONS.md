# Setup and operations

Canonical runbook for setup, database deployment and optional integrations.
`package.json`, `.env.example` and service code define commands and environment
names. Never copy real secrets into tracked documentation.

## Install and commands

Use Node.js 24 or newer (declared in `package.json`) and the pinned pnpm
10.26.0. First run `pnpm install --frozen-lockfile`. Build, test and type-check
commands explicitly generate Prisma Client, including on a fresh checkout;
there is no schema-text cache to invalidate.

| Command | Effect |
|---|---|
| `pnpm dev` | Generate Prisma Client and start Next.js |
| `pnpm test` | Generate Prisma Client and run Node source/service and architecture tests |
| `pnpm test:db` | Run the same suite with guarded disposable local PostgreSQL coverage; start the database first |
| `pnpm typecheck` | Generate Prisma Client and Next route types, then check TypeScript |
| `pnpm check:deadcode` | Check unused files/dependencies and unresolved/unlisted imports |
| `pnpm lint` | Run full ESLint |
| `pnpm build` | Generate Prisma Client, **deploy database migrations**, build Next.js with the verified webpack bundler |
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
data. If demo sign-in stops working on a previously seeded local database,
check the host and port in `DATABASE_URL` with `pg_isready -h <host> -p <port>`.
If its PostgreSQL container is stopped, start the existing container to restore
access to the seeded accounts and their data.

## TempoBuilder Ride (indoor trainer)

`/athlete/ride/[sessionId]` uses Web Bluetooth, which needs Chrome or Edge
(desktop or Android) on HTTPS or `localhost`. Safari and Firefox get a
targets-only ride and a pointer to the desktop app. Installer links (the public
`/download` page, linked from Settings, and the Start workout fallback) point at
the GitHub release `desktop-v<RIDE_DESKTOP_VERSION>` from `lib/ride/launch.ts`.
Optional `NEXT_PUBLIC_TEMPOBUILDER_RIDE_DOWNLOAD_URL` (build-time, public; the old `NEXT_PUBLIC_WATTONAUT_RIDE_DOWNLOAD_URL` and `NEXT_PUBLIC_TEMPO_RIDE_DOWNLOAD_URL` still work) replaces that
base: a folder that serves the five installer file names. While the repository
is private, the GitHub links only work for signed-in collaborators. Unsaved rides are kept in browser localStorage under
`tempo:ride:v1:<sessionId>` until the server confirms the import.

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

Users visit **Import → Strava inbox** to review synced activities, newest first.
The shell does not poll or open arrival dialogs. **Needs review** shows
unimported, undismissed activities; **All activities** includes imported and
dismissed items. **Refresh inbox** reloads locally synced data; **Sync now**
fetches recent activities from Strava. Opening an activity allows explicit
planned-session matching or standalone import. **Dismiss for now** only changes
inbox state; **Restore to inbox** makes it visible in Needs review again.
Unimported items remain reachable after they age out of the provider's recent
100-activity page. Manual sync and webhook updates preserve review choices.
Visiting Import schedules recovery of that owner's due webhook work after the
response; use Refresh inbox to see subsequently processed arrivals. A worker
schedule is still needed for retries while nobody visits Import.

Apply the notification migration before deploying this UI (`pnpm db:migrate`).
Verify the public callback challenge, create an activity in a connected Strava
account, then visit Import and check the inbox and planned-session/standalone outcomes. No new
storage allowance or retention deletion is implemented by this feature.

Disconnecting in TempoBuilder clears the connection and its imported Strava sessions,
then attempts to revoke the provider token. If Strava does not confirm
revocation, the page links to Strava's connected-app settings. Strava-side
authorization changes are received through the webhook.

### Posting to Strava

TempoBuilder asks for `activity:read,activity:read_all,activity:write` when connecting.
For a read-only connection, **Reconnect Strava** opens Strava’s consent screen
again and returns the athlete to the activity. Apply `20261123120000_activity_strava_post`
(`pnpm db:migrate`) before deploying. No new production environment variables
are needed. `STRAVA_API_BASE_URL` is a development-only override (accepted only
for `http://localhost` or `127.0.0.1`, ignored when `NODE_ENV=production`) for
running against a local stub; never point it at a real host. Every saved
activity with recorded data also offers **Download .tcx file** (session ⋯ menu)
for manual upload at strava.com/upload/select.

Prisma CLI reads `.env`, so a database-only `.env.local` is not sufficient for
`pnpm db:push`, `pnpm db:migrate`, or `pnpm db:setup`. `DATABASE_URL` is the
pooled runtime URL; `DIRECT_URL` is used for Prisma migrations and
should not use Neon’s `-pooler` hostname.

## Neon and Vercel

Only `main` deploys. `vercel.json` turns off Vercel deployments for every
other branch, so pushing a feature or release branch makes no preview build.

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
sport, length, effort, and whether to use intervals. TempoBuilder reads only their
completed sessions from the past 28 days to summarize recent training. A
server-side model call, when a model key is configured and its shared health
check succeeds, designs a complete workout with its own title and blocks. TempoBuilder
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
- The root layout bundles Schibsted Grotesk from `app/fonts/`; production builds
  use that local asset without a Google Fonts request.

Use [verification](VERIFICATION.md) for acceptance and
[current status](agent-workspace/CURRENT-STATUS.md) for evidence/open gates.

## Routine-only templates

Deploy this code with `20261001120000_template_routines` and
`20261001130000_retire_workout_templates`. The latter deliberately deletes old
block-backed template definitions, their blocks and share links, including
detached old template snapshots, and removes their schema fields. Calendar
copies and outcomes remain independent and are retained. Do not run the demo
seed on an existing account database. The seed now creates library workouts and
a weekday routine. No new environment variables or provider setup is required.

The cleanup was applied to the configured Neon database on 2026-10-01 after
disposable PostgreSQL acceptance. Old application builds referencing the removed
columns must be replaced with this code; database migration is not an app deploy.

## Imported workout analysis worker

Deploy migration 20261001150000_activity_analysis with this application version.
It adds the ActivityAnalysis table; it does not backfill or automatically analyze
existing activities. Analysis requires explicit opt-in on a running file import
or an owned session request. Strava sources remain excluded.

Set ACTIVITY_ANALYSIS_WORKER_SECRET to a dedicated random server secret. Configure
the hosting scheduler to call POST (GET is also supported) /api/activity-analysis/worker
with Authorization: Bearer <secret>, for example once per minute. Requests consider
at most two due jobs, each with a bounded model call; the route permits a sixty-second
runtime. Schedule overlap is safe under leases and global concurrency control.
Do not put the secret in a URL or client configuration. Monitor queue age and
failed jobs using ActivityAnalysis; responses count considered jobs, not completed
analyses. after() on imports/owned pending reads improves latency but is not a
replacement for the scheduler. The worker is not automatically provisioned here.

The existing WORKOUT_LLM_* / OPENAI provider configuration is reused. Missing keys
or invalid/provider-failed responses yield a calculated interpretation. No new
provider key is required. Manual requests have a ten-active-job owner cap and a
one-minute repeat cooldown; initial imports do not apply the manual cap. Global
live processing is capped at four with three attempts. Daily model budgets are
not implemented; configure provider spending limits before enabling broad use.
