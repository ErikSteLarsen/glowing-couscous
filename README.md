# Workout Planner

Workout Planner is a weekly training planning app for coaches and athletes. Coaches build and reuse structured training weeks, and athletes read their plan, request a coach connection, and mark sessions complete.

## Current Product State

- Auth is live through Auth.js v5 with credentials login plus optional Google sign-in.
- Coaches have a dashboard, a per-athlete week planner, and a private template library.
- Athletes can search for a coach, wait for approval, view their week, and mark sessions done with notes.
- Planning is week-scoped and starts on Monday everywhere in the app.

## Documentation Map

- `docs/agent-workspace/README.md` — **required starting point for agent work**; current status, related work, task tracking, decisions, and history.
- `docs/AI-HANDOFF.md` — **best starting point for a new AI contributor**; explains current state, extension points, and recommended next work.
- `ARCHITECTURE.md` — current implementation boundaries, route map, and safe places to add behavior.
- `SPEC.md` — product scope, shipped feature summary, and near-term roadmap.
- `CLAUDE.md` — repository-specific operating guidance for coding agents in environments that read it.

## Running Locally

Use `pnpm` for this project.

1. Copy `.env.example` to `.env.local`
2. Set `DATABASE_URL`
3. Set `AUTH_SECRET`
4. Optionally set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
5. Run `pnpm db:push`
6. Run `pnpm db:seed`
7. Run `pnpm dev`

## Seeded Demo Accounts

After `pnpm db:seed`, these credentials are available:

| Role | Email | Password |
|---|---|---|
| Coach | `coach@demo.local` | `demo1234` |
| Athlete | `maria@demo.local` | `demo1234` |
| Athlete | `anders@demo.local` | `demo1234` |

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm db:push
pnpm db:seed
```
