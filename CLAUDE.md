# Repository Guidance

Use `pnpm` and read `README.md` first. For non-trivial changes, read
`docs/agent-workspace/CURRENT-STATUS.md`, `docs/agent-workspace/WORK-INDEX.md`,
and the relevant sections of `ARCHITECTURE.md`.

## MVP Priority

Read PRODUCT.md for scope: the first MVP is a complete personal training
workflow without a coach. The existing Athlete role owns this experience.
Prioritize personal workout creation, planning, completion, and review; coach
collaboration is secondary. Preserve existing role and ownership boundaries.

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
- `lib/planner-service.ts` is compatibility code. Extend `lib/athlete-planner-service.ts` for personal planning or the relevant shared/domain owner; use `lib/coach-planner-service.ts` for coach planning.

See `ARCHITECTURE.md` for the full owner map and route boundaries.

## Design Shortcuts

- `DESIGN.md` is the durable visual contract; `app/globals.css` is its token implementation.
- Reuse `components/ui.tsx`, `components/tempo/*`, `AppShell`, `AppSidebar`, and `WorkoutBuilder` before adding new visual primitives.
- `/design/*` routes are alternate previews, not production references.
- Preserve visible focus, reduced-motion behavior, explicit labels, semantic state text, and 44px ordinary controls.

## Documentation Updates

Keep `CURRENT-STATUS.md` and `WORK-INDEX.md` concise and current. Do not add
dated plans, handoffs, decisions, or history files for completed work.
