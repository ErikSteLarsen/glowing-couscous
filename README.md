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
4. Run `pnpm db:setup` to create and seed the local SQLite database.
5. Run `pnpm dev`.

Prisma CLI reads `.env`, so a database-only `.env.local` is not sufficient for
`pnpm db:push` or `pnpm db:setup`.

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
pnpm db:seed
```

`pnpm db:push` may reset local SQLite data. Run `pnpm db:seed` afterward when
you need demo data again.
