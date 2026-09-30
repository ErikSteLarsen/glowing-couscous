# Workout Planner / Tempo

Tempo helps people create reusable endurance workouts, schedule them in a
Monday-first calendar, follow sessions, and review saved outcomes without a
coach. The Athlete workspace is the personal experience. Existing coach code
is secondary compatibility; preserve its authorization boundaries.

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
| [Verification](docs/VERIFICATION.md) | Repeatable automated, database, browser and device acceptance |
| [Current status](docs/agent-workspace/CURRENT-STATUS.md) | Latest recorded evidence and unresolved gates |
| [Work index](docs/agent-workspace/WORK-INDEX.md) | Capability-to-owner lookup and active work |

Source and tests override docs. Each topic has one authoritative home; status
is a snapshot, not a changelog. Tool entry points link here instead of copying rules.
