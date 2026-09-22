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
4. Set `DATABASE_URL` to a Neon pooled PostgreSQL connection string and
   `DIRECT_URL` to the matching Neon direct connection string. For local
   development, a local PostgreSQL database can be used for both values.
5. Run `pnpm db:setup` to apply migrations and seed demo data.
6. Run `pnpm dev`.

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
