import {
  addSessionEditorBlock,
  createEmptySessionEditorDraft,
  createSessionEditorBlock,
  createSessionEditorDraftFromPersisted,
  moveSessionEditorBlock,
  removeSessionEditorBlock,
  serializeSessionEditorDraft,
  updateSessionEditorBlock,
  updateSessionEditorFields,
  validateSessionEditorDraft,
  type PersistedSessionRecord,
  type SessionEditorBlock,
  type SessionEditorBlockPatch,
  type SessionEditorDraft,
} from './session-editor.ts';
import type { TempoBlockKind } from './tempo-blocks.ts';

export type PlannerOwnershipMode = 'coach-library' | 'training-plan' | 'athlete';

export type PlannerEditorDraft = SessionEditorDraft & {
  ownershipMode: PlannerOwnershipMode;
  sourceTemplateId: number | null;
};

export type PlannerEditorTemplateRecord = {
  id: number;
  sport: string;
  name: string;
  summary: string | null;
  blocks: Array<{
    id: number;
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetLow: number | null;
    targetHigh: number | null;
    note: string | null;
    sortOrder: number;
  }>;
};

export type PlannerEditorPersistedSession = PersistedSessionRecord & {
  ownershipMode?: PlannerOwnershipMode;
  sourceTemplateId?: number | null;
};

export function createEmptyPlannerEditorDraft(input: {
  ownershipMode?: PlannerOwnershipMode;
  athleteId?: number | null;
  scheduledDate: string | null;
  planWeekday?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  sport?: string;
}): PlannerEditorDraft {
  const blocks = [
    createSessionEditorBlock({ kind: 'warmup', zone: 1, durationSec: 600, note: 'Easy warmup' }),
    createSessionEditorBlock({ kind: 'work', zone: 3, durationSec: 1800, note: 'Main work' }),
    createSessionEditorBlock({ kind: 'cooldown', zone: 1, durationSec: 600, note: 'Cooldown' }),
  ];
  const ownershipMode = input.ownershipMode ?? 'athlete';

  return {
    ...createEmptySessionEditorDraft({
      mode: 'create',
      athleteId: input.athleteId ?? null,
      scheduledDate: input.scheduledDate,
      planWeekday: input.planWeekday ?? null,
      sport: input.sport ?? 'RUNNING',
      blocks,
    }),
    ownershipMode,
    sourceTemplateId: null,
  };
}

export function createPlannerEditorDraftFromPersisted(
  input: PlannerEditorPersistedSession,
): PlannerEditorDraft {
  return {
    ...createSessionEditorDraftFromPersisted('planned', input),
    ownershipMode: input.ownershipMode ?? 'athlete',
    sourceTemplateId: input.sourceTemplateId ?? input.templateId ?? null,
  };
}

export function createPlannerEditorDraftFromTemplate(
  template: PlannerEditorTemplateRecord,
  input: {
    ownershipMode?: PlannerOwnershipMode;
    athleteId?: number | null;
    scheduledDate: string | null;
    planWeekday?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  },
): PlannerEditorDraft {
  const draft = createSessionEditorDraftFromPersisted('create', {
    sport: template.sport,
    title: template.name,
    summary: template.summary,
    athleteId: input.athleteId ?? null,
    scheduledDate: input.scheduledDate,
    planWeekday: input.planWeekday ?? null,
    blocks: template.blocks,
  });

  return {
    ...draft,
    ownershipMode: input.ownershipMode ?? 'athlete',
    sourceTemplateId: template.id,
  };
}

export function addPlannerEditorBlock(draft: PlannerEditorDraft, kind: TempoBlockKind = 'work') {
  return preservePlannerContext(
    draft,
    addSessionEditorBlock(draft, { kind, zone: kind === 'recovery' ? 1 : 3 }),
  );
}

export function updatePlannerEditorBlock(
  draft: PlannerEditorDraft,
  index: number,
  patch: SessionEditorBlockPatch,
) {
  return preservePlannerContext(draft, updateSessionEditorBlock(draft, index, patch));
}

export function removePlannerEditorBlock(draft: PlannerEditorDraft, index: number) {
  return preservePlannerContext(draft, removeSessionEditorBlock(draft, index));
}

export function movePlannerEditorBlock(draft: PlannerEditorDraft, fromIndex: number, toIndex: number) {
  return preservePlannerContext(draft, moveSessionEditorBlock(draft, fromIndex, toIndex));
}

export function updatePlannerEditorFields(
  draft: PlannerEditorDraft,
  patch: Parameters<typeof updateSessionEditorFields>[1],
) {
  return preservePlannerContext(draft, updateSessionEditorFields(draft, patch));
}

export function serializePlannerEditorDraftForSave(draft: PlannerEditorDraft) {
  const serialized = serializeSessionEditorDraft(draft);

  return {
    ownershipMode: draft.ownershipMode,
    athleteId: serialized.athleteId,
    scheduledDate: serialized.scheduledDate,
    planWeekday: serialized.planWeekday,
    sport: serialized.sport,
    title: serialized.title,
    summary: serialized.summary ?? '',
    sourceTemplateId: draft.sourceTemplateId,
    sportMetrics: serialized.sportMetrics,
    blocks: serialized.blocks,
  };
}

export function validatePlannerEditorDraft(draft: PlannerEditorDraft): string | null {
  if (draft.ownershipMode === 'coach-library') {
    if (!draft.scheduledDate) return 'A coach session date is required.';
    if (draft.planWeekday !== null) return 'Standalone coach sessions cannot have a training-plan weekday.';
  }

  if (draft.ownershipMode === 'training-plan') {
    if (draft.planWeekday === null) return 'Choose a weekday for the training-plan session.';
    if (draft.scheduledDate) return 'Training-plan sessions use a weekday instead of a fixed date.';
  }

  if (draft.ownershipMode === 'athlete') {
    if (!Number.isInteger(draft.athleteId) || (draft.athleteId ?? 0) <= 0) {
      return 'Choose an athlete before saving.';
    }
    if (!draft.scheduledDate) return 'A valid scheduled date is required.';
  }

  return validateSessionEditorDraft(draft);
}

export function createEmptyTemplateEditorDraft() {
  return createEmptySessionEditorDraft({
    mode: 'create',
    blocks: [createSessionEditorBlock({ kind: 'work', zone: 3, durationSec: 900 })],
  });
}

export function createTemplateEditorDraftFromRecord(template: PlannerEditorTemplateRecord) {
  return createSessionEditorDraftFromPersisted('create', {
    templateId: template.id,
    sport: template.sport,
    title: template.name,
    summary: template.summary,
    blocks: template.blocks,
  });
}

export function serializeTemplateEditorDraftForSave(draft: SessionEditorDraft) {
  const serialized = serializeSessionEditorDraft(draft);
  return {
    name: serialized.title,
    sport: serialized.sport,
    summary: serialized.summary ?? '',
    blocks: serialized.blocks,
  };
}

function preservePlannerContext(draft: PlannerEditorDraft, next: SessionEditorDraft): PlannerEditorDraft {
  return {
    ...next,
    ownershipMode: draft.ownershipMode,
    sourceTemplateId: draft.sourceTemplateId,
  };
}
