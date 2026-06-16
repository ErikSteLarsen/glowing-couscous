# AI Documentation Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repo documentation immediately useful to a new AI contributor by separating current state, extension rules, and near-term next work.

**Architecture:** Keep `README.md` as the short human-facing project index, add a dedicated `docs/AI-HANDOFF.md` as the first stop for AI contributors, tighten `ARCHITECTURE.md` to describe the implemented system, and narrow `SPEC.md` to product direction and next-state planning. Preserve existing file names where they already fit, and add cross-links so the docs form one coherent map instead of overlapping narratives.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + SQLite, Auth.js v5, pnpm, Markdown.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `README.md` | Short overview, local setup, and documentation map. |
| Create | `docs/AI-HANDOFF.md` | Primary AI onboarding document covering current state, code boundaries, and recommended next work. |
| Modify | `ARCHITECTURE.md` | Current implemented architecture, route map, and safe extension points. |
| Modify | `SPEC.md` | Product scope, shipped state summary, and near-term roadmap. |
| Create | `docs/superpowers/specs/2026-06-16-ai-documentation-handoff-design.md` | Design note for the documentation restructure. |

---

### Task 1: Add the AI handoff document

**Files:**
- Create: `docs/AI-HANDOFF.md`

- [ ] **Step 1: Write the handoff sections**

```md
# AI Handoff

## What this app is
## Current shipped state
## Route map
## Data model and auth model
## Service boundaries
## Known transitional areas
## Recommended next steps
```

- [ ] **Step 2: Fill in current-state details from the implemented app**

```md
- Auth is live through Auth.js with credentials and optional Google sign-in.
- Coaches manage athlete planners and templates.
- Athletes can request a coach, view their week, and mark sessions complete.
- Planner mutations flow through `lib/planner-service.ts`.
- Template mutations flow through `lib/template-service.ts`.
```

- [ ] **Step 3: Call out the highest-value next work**

```md
1. Finish removing `lib/demo-data.ts` from remaining read paths.
2. Add boundary-focused tests around planner, template, and auth flows.
3. Keep tightening athlete onboarding and coach request visibility.
```

### Task 2: Turn `README.md` into the repo index

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Keep the top-level overview short**

```md
# Workout Planner

Workout Planner is a weekly training planning app for coaches and athletes.
```

- [ ] **Step 2: Add a documentation map**

```md
## Documentation Map

- `docs/AI-HANDOFF.md` — fastest way for an AI contributor to understand the repo.
- `ARCHITECTURE.md` — current implementation boundaries and extension rules.
- `SPEC.md` — product scope and near-term roadmap.
```

- [ ] **Step 3: Keep setup instructions current**

```md
1. Copy `.env.example` to `.env.local`
2. Set `AUTH_SECRET`
3. Optionally set Google OAuth credentials
4. Run `pnpm db:push`
5. Run `pnpm db:seed`
6. Run `pnpm dev`
```

### Task 3: Rewrite `ARCHITECTURE.md` around the shipped system

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Document the route surface**

```md
- `/login`, `/signup`, `/setup`
- `/coach`
- `/coach/athletes/[athleteId]`
- `/coach/templates`
- `/athlete`
- `/athlete/profile`
- `/athlete/find-coach`
```

- [ ] **Step 2: Document the service boundaries**

```md
- `lib/planner-service.ts` owns planner reads and mutations.
- `lib/template-service.ts` owns coach template mutations and listing.
- `lib/auth-session.ts` owns current-user lookup in server-rendered UI.
- `lib/api-auth.ts` owns route-level role guards.
```

- [ ] **Step 3: Document transitional areas explicitly**

```md
- `lib/demo-data.ts` still provides some read helpers and shared labels.
- Some pages still depend on those helpers for dashboard and athlete-week shaping.
```

### Task 4: Narrow `SPEC.md` to product scope and next-state planning

**Files:**
- Modify: `SPEC.md`

- [ ] **Step 1: Add a clear distinction between shipped state and target state**

```md
## Current Product State
- Real auth is implemented.
- Coach-athlete request/accept flow exists.
- Weekly planning, templates, and athlete completion exist.
```

- [ ] **Step 2: Replace stale build-order language with roadmap language**

```md
## Near-Term Product Roadmap
1. Consolidate remaining read paths behind service boundaries.
2. Add boundary-level test coverage.
3. Improve onboarding and navigation polish.
```

- [ ] **Step 3: Keep non-goals explicit**

```md
- Multi-coach collaboration
- Full recurrence rules
- Month-planner editing
- Deep analytics
```

### Task 5: Re-read the docs together and tighten cross-links

**Files:**
- Modify: `README.md`
- Modify: `docs/AI-HANDOFF.md`
- Modify: `ARCHITECTURE.md`
- Modify: `SPEC.md`

- [ ] **Step 1: Inspect the doc-only diff**

Run: `git --no-pager diff -- README.md docs/AI-HANDOFF.md ARCHITECTURE.md SPEC.md docs/superpowers/specs/2026-06-16-ai-documentation-handoff-design.md docs/superpowers/plans/2026-06-16-ai-documentation-handoff.md`
Expected: only documentation changes appear

- [ ] **Step 2: Re-open the edited docs and remove overlap**

```md
- `README.md` should stay short.
- `docs/AI-HANDOFF.md` should answer "what is here and what next?"
- `ARCHITECTURE.md` should stay implementation-focused.
- `SPEC.md` should stay product-focused.
```

## Self-review

- **Spec coverage:** The plan covers the entry-point problem, current-state documentation, extension-boundary documentation, and next-step guidance for future AI contributors.
- **Placeholder scan:** No TBD or TODO placeholders remain in the execution steps.
- **Type consistency:** All referenced files, routes, and modules match the current repository names.
