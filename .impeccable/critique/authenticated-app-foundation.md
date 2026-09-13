# Impeccable critique: authenticated app foundation

Method: dual-agent (A: source design review · B: detector/source evidence)

## Scope

`app/globals.css`, `components/ui.tsx`, `components/AppShell.tsx`,
`components/AppSidebar.tsx`, and `components/tempo/*`.

## Evidence

- Assessment A found a coherent but category-interchangeable navy split-board
  foundation that does not make the Monday-first week persistent.
- Assessment B ran the Impeccable detector over eight production foundation
  files: `[]` (0 findings, 0 rules, 0 locations).
- No browser evidence was available because no desktop browser was connected.
- Focused source-contract tests passed before this redesign: 39/39.

## Health score

| Heuristic | Score | Key issue |
|---|---:|---|
| Visibility of system status | 3/4 | Local feedback exists, but shared loading/error/permission grammar is missing. |
| Match between system and real world | 2/4 | Training vocabulary is present; the spatial model is not week-first. |
| User control and freedom | 2/4 | Drawer behavior lacks robust Escape/focus recovery. |
| Consistency and standards | 3/4 | Shared tokens are strong; hardcoded states and mobile divergence remain. |
| Error prevention | 2/4 | No shared retry/recovery or conflict pattern. |
| Recognition rather than recall | 2/4 | Week/current-day context is not persistent. |
| Flexibility and efficiency | 2/4 | Compact controls exist, but no fast week/session path or intentional grouping. |
| Aesthetic and minimalist design | 2/4 | Repeated card/shadow/stat patterns dilute calm density. |
| Error recovery | 2/4 | No shared retry state; focus recovery is incomplete. |
| Help and documentation | 1/4 | No contextual help primitive. |
| **Total** | **22/40** | **Acceptable; significant improvement required for the new direction.** |

## Highest-value issues selected for this batch

1. **P1 — The foundation encodes independent cards, not a shared week.** Add
   the width/density/token seams needed by the week-at-a-glance family without
   migrating route composition yet.
2. **P1 — Mobile navigation hides Calendar and Activity.** Replace the silent
   first-four slice with deliberate role-specific mobile destinations and add
   accessible sidebar active state/focus behavior.
3. **P1 — State semantics are incomplete.** Add semantic state tokens and
   non-color cues for status/bar primitives; keep workout-zone serialization
   untouched.
4. **P2 — The incumbent has competing signals and elevated card defaults.**
   Establish one action/current-day signal, calmer tonal grouping, production
   reduced-motion behavior, and semantic overlay/shadow tokens.

## Deferred to later family reviews

- Concrete week header/day/session compositions in Home and Calendar.
- Session-row migration across route-local pages.
- Coach roster/planner information architecture.
- Shared retry/loading/permission UI where route data contracts are known.

## Persona red flags

- **Alex:** no fast week/session path; too many ungrouped destinations; repeated
  panels require cross-page scanning.
- **Sam:** transformed-offscreen mobile drawer may retain tab stops; sidebar
  active state lacks `aria-current`; session block bar lacks an aggregate text
  summary; production reduced motion is incomplete.
- **Casey:** important mobile destinations are hidden; current week is not
  persistent; top-of-screen menu and missing safe-area treatment increase
  interruption cost.

## Browser limitation

Manual viewport and runtime accessibility evidence remain required after the
first implementation batch.
