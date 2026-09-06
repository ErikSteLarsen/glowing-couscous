# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Athletes are the primary users. They use the product in the context of following
a structured endurance training week: discovering or connecting with a coach,
understanding planned sessions, executing them, and recording completion and
notes. Coaches are a supporting audience who create structured sessions, reuse
training plans, assign work, and support athletes through the same planning loop.

## Product Purpose

Workout Planner is an athlete-led structured training planner for endurance
training. It makes a coach-backed weekly plan understandable and actionable,
then gives athletes a place to follow sessions and record what happened. Success
means an athlete can reliably find the right session, understand its structure,
complete it, and preserve useful history while a coach can create and reuse the
plan that supports that work.

## Positioning

The product centers the athlete experience while keeping coach-authored weekly
planning, structured workout blocks, execution guidance, and completion history
in one connected model. Its organizing mechanism is the shared, Monday-based
training week rather than a collection of disconnected workouts or notes.

## Operating Context

- Training weeks begin on Monday throughout the product.
- Athletes move among Home, Calendar, Workouts, Session, Live, and Activity
  surfaces while following their plan.
- Coaches work with rosters, per-athlete planning, reusable sessions, templates,
  and training plans.
- The product is used in a web browser and supports role-specific coach and
  athlete workflows.

## Capabilities and Constraints

- Authentication and role separation distinguish coaches from athletes. The
  current implementation uses Auth.js credentials login with optional Google
  sign-in.
- Athletes can search for a coach, submit a connection request, view assigned
  training, run through a session stepper, mark sessions complete, and retain
  notes and actual outcomes.
- Coaches can manage rosters, build structured sessions, reuse templates and
  training plans, and assign sessions to athletes.
- Workout structure is represented by typed blocks with derived metrics such as
  duration, training load, and zone distribution.
- Live execution is a local guidance stepper. It does not record device or
  sensor telemetry.
- Messaging is not implemented; current discovery copy treats it as future
  functionality.
- Universal workout and template sharing exists in the current implementation,
  but browser acceptance coverage remains an open verification gap.
- The exact public product name is undecided in the current repository: project
  documentation uses `Workout Planner`, while the application metadata uses
  `Tempo`.

## Brand Commitments

No additional voice, identity, asset, or visual commitment was confirmed in
this init. Preserve the existing product naming evidence until the public name
is decided; visual system decisions belong in `DESIGN.md`, not this record.

## Evidence on Hand

- Product scope and current capabilities: `README.md` and
  `docs/agent-workspace/CURRENT-STATUS.md`.
- Current route and service implementation: `app/`, `components/`, and `lib/`.
- Regression evidence: `tests/`, with the latest recorded full verification in
  `docs/agent-workspace/CURRENT-STATUS.md`.
- Local demonstration data and credentials are documented in `README.md` and
  seeded by `prisma/seed.js`.
- No external customer research, testimonials, benchmarks, production usage
  evidence, or approved marketing claims are present in the repository.

## Product Principles

- Put athlete clarity first: the next session and its purpose should be easy to
  understand and act on.
- Keep planning structured: preserve meaningful workout blocks, targets, and
  derived metrics instead of flattening training into generic notes.
- Connect planning to reality: completion, notes, and actual outcomes should
  remain useful after a session ends.
- Respect role ownership: coaches create and assign plans; athletes control
  their execution and personal outcomes.
- Preserve the weekly rhythm: Monday-based planning is a product convention,
  not an incidental display choice.

## Accessibility & Inclusion

No product-specific accessibility standard was confirmed during init. Future
work should preserve accessible web defaults and avoid introducing interaction
patterns that make the coach or athlete workflows less usable.
