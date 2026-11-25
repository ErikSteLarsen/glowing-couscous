# Wattonaut

Wattonaut is an app for planning and following your own endurance training. The
first MVP focuses on creating reusable workouts, scheduling them in a
Monday-based calendar, following sessions, and recording and reviewing outcomes
without needing a coach. The Athlete workspace is the personal experience.
Existing coach code is secondary compatibility; preserve its authorization
boundaries.

## Start locally

1. Use the pnpm version pinned in `package.json`; run `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env`; configure PostgreSQL `DATABASE_URL`, direct
   `DIRECT_URL`, `AUTH_SECRET` and `AUTH_URL`.
3. Run `pnpm db:migrate`, then `pnpm dev`.
4. Sign up for a fresh personal account. Optional demo seeding **deletes existing data**.

The [operations runbook](docs/OPERATIONS.md) covers runtime requirements,
commands, Neon/Vercel, demo accounts, recovery, Strava and model providers.
`pnpm build` deploys migrations before building; it is not a database-free check.

## Documentation map

| Document | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Shared contributor/agent rules and reading order |
| [PRODUCT.md](PRODUCT.md) | Product scope, MVP priority and constraints |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Routes, service owners, data and extension boundaries |
| [DESIGN.md](DESIGN.md) | Durable visual and interaction contract |
| [Operations](docs/OPERATIONS.md) | Setup, environment, deployment and integrations |
| [UI SDK integration](docs/UI-SDK.md) | Shared interaction owners, pinned SDK docs and browser acceptance |
| [Verification](docs/VERIFICATION.md) | Repeatable automated, database, browser and device acceptance |
| [Current status](docs/agent-workspace/CURRENT-STATUS.md) | Latest recorded evidence and unresolved gates |
| [Work index](docs/agent-workspace/WORK-INDEX.md) | Capability-to-owner lookup and active work |

Source and tests override docs. Each topic has one authoritative home; status
is a snapshot, not a changelog. Tool entry points link here instead of copying rules.

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

## Demo Accounts

The seed command creates these local accounts:

| Role | Email | Password |
|---|---|---|
| Coach | `coach@demo.local` | `demo1234` |
| Athlete | `mara@demo.local` | `demo1234` |
| Athlete | `jonas@demo.local` | `demo1234` |
| Athlete | `sofie@demo.local` | `demo1234` |

## Commands

```bash
pnpm dev
pnpm test
pnpm test:db
pnpm typecheck
pnpm check:deadcode
pnpm lint
pnpm build
pnpm db:migrate
pnpm db:setup
pnpm db:push
pnpm db:seed
```

Use `pnpm db:migrate` (Prisma `migrate deploy`) to apply the checked-in
migrations in `prisma/migrations`; `pnpm build` runs the same deploy step.
`pnpm db:setup` migrates and then seeds demo data. `pnpm db:push` syncs the
schema without migration history and may reset local data, so use it only for
throwaway databases.

## Authentication runtime check

The production authentication proxy runs in Node.js so a roleless account can
refresh its JWT through Prisma. To check this path against the local database:

```bash
pnpm build
AUTH_TRUST_HOST=true pnpm start --port 3100
```

In another terminal:

```bash
node --env-file=.env scripts/verify-roleless-setup.mjs
```

The check creates and deletes a temporary account. It covers credentials
sign-in, setup navigation, same-role retries, JWT refresh, and role redirects.
`AUTH_TRUST_HOST=true` here enables the localhost verification server.
