# Repository Guidance

Use `pnpm` and read `README.md` first. For non-trivial changes, read
`docs/agent-workspace/CURRENT-STATUS.md`, `docs/agent-workspace/WORK-INDEX.md`,
and the relevant sections of `ARCHITECTURE.md`.

## Commands

```bash
pnpm dev          # Generate Prisma Client and start Next.js
pnpm test         # Run the source and architecture tests
pnpm lint         # Run ESLint
pnpm build        # Generate Prisma Client and build production output
pnpm db:setup     # Push the SQLite schema and seed demo data
pnpm db:push      # Push schema changes; may reset local data
pnpm db:seed      # Seed demo data
```

## Architecture Shortcuts

- `app/` contains App Router pages and thin API adapters.
- `lib/` contains domain services, validation, persistence transforms, and derived metrics.
- `components/` contains shared shell, editor, workout, and Tempo UI primitives.
- `prisma/schema.prisma` is the data-model source of truth.
- Weeks start on Monday everywhere.
- Workouts are owner-scoped unscheduled definitions; Planner creates dated copies.
- `lib/planner-service.ts` is compatibility code. Extend `lib/coach-planner-service.ts` or the owning service for new behavior.

See `ARCHITECTURE.md` for the full owner map and route boundaries.

## Documentation Updates

Keep `CURRENT-STATUS.md` and `WORK-INDEX.md` concise and current. Do not add
dated plans, handoffs, decisions, or history files for completed work.
