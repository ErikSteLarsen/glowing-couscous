# Coach-owned library and training-plan design

## Goal

Let coaches start building useful training assets before they have athletes. The system should support coach-owned templates, coach-owned standalone sessions, and coach-owned training plans. Athlete assignment stays out of scope for this delivery, but the design must keep a clean path for adding it later.

## Summary

Use one shared training-session concept across the application, but allow different ownership containers around it.

- **Templates** remain coach-owned reusable session structures with no date.
- **Training plans** are new coach-owned reusable blueprints that place sessions on weekdays rather than fixed dates.
- **Sessions** stay the single workout shape, but gain nullable ownership fields so the same model can represent coach-owned standalone work, sessions inside training plans, and existing athlete-assigned sessions.

This removes the current athlete-first blocker while keeping later assignment as a copy-based flow instead of live sync.

## Scope

### In scope

- Make `/coach/planner` usable when the coach has zero athletes.
- Let coaches create and manage coach-owned standalone sessions.
- Add a coach-owned `TrainingPlan` object for reusable weekday-based planning.
- Reuse one session shape across coach-owned and athlete-owned planning flows.
- Preserve existing athlete planning behavior.

### Out of scope

- Assigning a training plan to an athlete.
- Live sync between source plans and assigned athlete sessions.
- Athlete-facing visibility for unfinished coach-owned work.

## Domain model

### Templates

Keep the existing template concept. A template is still the best place for reusable block structure without a scheduled slot.

### TrainingPlan

Add a new coach-owned `TrainingPlan` parent object for reusable weekly blueprints.

Suggested fields:

- `id`
- `coachOwnerId`
- `name`
- `summary`
- `sport`
- `createdAt`
- `updatedAt`

`TrainingPlan` does not store fixed dates. It stores reusable weekday intent through its child sessions.

### Session

Keep one shared session record shape, but extend ownership so the same object can work in multiple contexts.

Suggested additions and changes:

- add `coachOwnerId Int?`
- make `athleteId Int?`
- add `trainingPlanId Int?`
- make `date DateTime?`
- add `planWeekday Int?` for reusable plan placement (`1` = Monday through `7` = Sunday)
- keep `templateId Int?`
- keep existing workout content fields and block relation
- keep sport-specific metrics as nullable fields or grouped nullable subfields on the shared session shape

Ownership rules:

1. A session belongs to exactly one active planning container at a time.
2. Valid modes are:
   - coach-owned standalone session: `coachOwnerId` set, `trainingPlanId` null, `athleteId` null, `date` required, `planWeekday` null
   - coach-owned training-plan session: `coachOwnerId` set, `trainingPlanId` set, `athleteId` null, `date` null, `planWeekday` required
   - athlete-assigned session: `athleteId` set, `date` required, existing athlete planning relations allowed
3. `templateId` is optional metadata describing where a session started, not the container that owns it.

This gives one session concept without forcing one parent structure for every use case.

## Coach workflow

Change the planner from an athlete-gated page into a broader coach workspace.

### Workspace sections

`/coach/planner` should support three coach-side surfaces:

1. **Templates**
2. **Session library**
3. **Training plans**

### Session library

Coaches can:

- create a session from scratch
- start from a template
- edit or delete a saved coach-owned session

These sessions are saved without requiring athlete selection.

### Training plans

Coaches can:

- create a reusable plan
- add sessions to weekdays such as Monday, Wednesday, and Saturday
- define intended intensity/load at the session level
- reuse templates or existing session-library items as a starting point

Each plan slot points to a real shared session record rather than a separate session subtype.

### Existing athlete planning

Keep athlete planning available, but move it out of the role of entry gate. If athletes exist, athlete-specific planning can remain as another planner mode that works with the same session model.

## Service and API design

Keep Prisma access behind the service layer.

### Services

- extend the coach planner service or add a focused coach workspace service that loads:
  - templates
  - coach-owned standalone sessions
  - coach-owned training plans
  - athlete-specific planner data when relevant
- keep athlete-facing reads in existing athlete services
- keep later assignment logic separate from coach-owned authoring

### API routes

Add or adapt coach-only endpoints for:

- coach session-library create/update/delete
- training-plan create/update/delete
- training-plan session create/update/delete/reorder

Existing athlete planner routes can keep their behavior, but should share the common session validation and serialization logic.

## Validation and behavior safety

Validation should make ownership explicit instead of relying on UI assumptions.

Required checks:

- a session must match exactly one ownership mode
- coach-owned work cannot leak into athlete reads
- training-plan sessions must carry `planWeekday`
- athlete-assigned sessions must still satisfy existing athlete ownership checks
- template-derived sessions can preserve `templateId`, but editing them must not mutate the source template

## Migration strategy

1. Add the new `TrainingPlan` model.
2. Extend `Session` with coach ownership and training-plan linkage.
3. Make `Session.athleteId` and `Session.date` nullable, then add `planWeekday`.
4. Update service queries so coach-owned workspace data no longer depends on roster presence.
5. Update the planner UI so the zero-athlete state becomes usable instead of blocked.

The key compatibility rule is that current athlete sessions continue to work as one valid ownership mode of the expanded session model.

## Later assignment path

When assignment is added in a future change:

- assigning a training plan should copy source sessions into athlete-owned session rows
- copied sessions may diverge afterward
- source coach-owned plans should not live-sync into athlete schedules

This matches the approved product direction and avoids brittle downstream coupling.

## Testing strategy

Add or update tests for:

- coach workspace loading with zero athletes
- session ownership validation
- coach-owned standalone session CRUD
- training-plan CRUD
- training-plan weekday placement
- existing athlete planner flows staying intact

Prefer service and pure-helper tests first, then targeted route coverage for the new coach-only endpoints.

## Recommended implementation shape

1. Expand the schema and shared session draft/serialization helpers.
2. Add training-plan services and coach-owned session-library services.
3. Update `/coach/planner` to support coach-owned authoring without athletes.
4. Preserve existing athlete planning as a compatible mode on top of the same session model.

This is the smallest coherent path that unlocks coach prep work now without baking athlete-specific assumptions deeper into the system.
