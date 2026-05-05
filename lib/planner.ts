import { formatISO } from 'date-fns';
import { prisma } from '@/lib/prisma';
import {
  createEmptyWorkoutContentDraft,
  createSessionDraftFromWorkoutContent,
  createTemplateDraftFromWorkoutContent,
  createWorkoutContentDraftFromRecord,
} from '@/lib/workout-editor';
import { normalizeWorkoutBlockDrafts, serializeWorkoutBlocksForPersistence, validateWorkoutBlocks, WorkoutBlockDraft } from '@/lib/workout-spec';

export const SPORT_OPTIONS = ['RUNNING', 'BIKING', 'SWIMMING', 'STRENGTH', 'STRETCHING', 'REST'] as const;
export const BLOCK_OPTIONS = ['WARMUP', 'MAIN_SET', 'COOLDOWN', 'INTERVALS', 'REPS', 'REST', 'NOTE'] as const;

export type SessionDraft = {
  scheduledDate: string;
  sportType: string;
  title: string;
  summary: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  intensity: string;
  sourceTemplateId: number | null;
  blocks: WorkoutBlockDraft[];
};

export type TemplateDraft = {
  sportType: string;
  name: string;
  summary: string;
  blocks: WorkoutBlockDraft[];
};

export function normalizeSessionDraft(input: unknown): SessionDraft {
  const draft = (input ?? {}) as Record<string, unknown>;

  return {
    scheduledDate: typeof draft.scheduledDate === 'string' ? draft.scheduledDate : '',
    sportType: typeof draft.sportType === 'string' ? draft.sportType : 'RUNNING',
    title: typeof draft.title === 'string' ? draft.title.trim() : '',
    summary: typeof draft.summary === 'string' ? draft.summary.trim() : '',
    durationMinutes: toNullableInt(draft.durationMinutes),
    distanceKm: toNullableFloat(draft.distanceKm),
    intensity: typeof draft.intensity === 'string' ? draft.intensity.trim() : '',
    sourceTemplateId: toNullableInt(draft.sourceTemplateId),
    blocks: normalizeWorkoutBlockDrafts(draft.blocks),
  };
}

export function validateSessionDraft(draft: SessionDraft) {
  if (!draft.scheduledDate || Number.isNaN(new Date(draft.scheduledDate).getTime())) {
    return 'A valid scheduled date is required.';
  }
  if (!draft.title) {
    return 'Session title is required.';
  }
  if (!SPORT_OPTIONS.includes(draft.sportType as (typeof SPORT_OPTIONS)[number])) {
    return 'Sport type is invalid.';
  }

  return validateWorkoutBlocks(draft.blocks, BLOCK_OPTIONS);
}

export function normalizeTemplateDraft(input: unknown): TemplateDraft {
  const draft = (input ?? {}) as Record<string, unknown>;

  return {
    sportType: typeof draft.sportType === 'string' ? draft.sportType : 'RUNNING',
    name: typeof draft.name === 'string' ? draft.name.trim() : '',
    summary: typeof draft.summary === 'string' ? draft.summary.trim() : '',
    blocks: normalizeWorkoutBlockDrafts(draft.blocks),
  };
}

export function validateTemplateDraft(draft: TemplateDraft) {
  if (!draft.name) {
    return 'Template name is required.';
  }
  if (!SPORT_OPTIONS.includes(draft.sportType as (typeof SPORT_OPTIONS)[number])) {
    return 'Sport type is invalid.';
  }

  return validateWorkoutBlocks(draft.blocks, BLOCK_OPTIONS);
}

export async function saveCoachTemplate(coachId: number, draftInput: unknown, templateId?: number) {
  const draft = normalizeTemplateDraft(draftInput);
  const validationError = validateTemplateDraft(draft);

  if (validationError) {
    return { error: validationError };
  }

  const templateData = {
    coachId,
    sportType: draft.sportType,
    name: draft.name,
    summary: draft.summary || null,
  };

  if (!templateId) {
    await prisma.sessionTemplate.create({
      data: {
        ...templateData,
        blocks: {
          create: serializeWorkoutBlocksForPersistence(draft.blocks),
        },
      },
    });

    return { error: null };
  }

  const existing = await prisma.sessionTemplate.findUnique({ where: { id: templateId } });
  if (!existing || existing.coachId !== coachId) {
    return { error: 'Template not found.' };
  }

  await prisma.$transaction([
    prisma.sessionTemplateBlock.deleteMany({ where: { templateId } }),
    prisma.sessionTemplate.update({
      where: { id: templateId },
      data: {
        sportType: draft.sportType,
        name: draft.name,
        summary: draft.summary || null,
        blocks: {
          create: serializeWorkoutBlocksForPersistence(draft.blocks),
        },
      },
    }),
  ]);

  return { error: null };
}

export async function deleteCoachTemplate(coachId: number, templateId: number) {
  const template = await prisma.sessionTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.coachId !== coachId) {
    return { error: 'Template not found.' };
  }

  await prisma.sessionTemplate.delete({ where: { id: templateId } });
  return { error: null };
}

export function templateToDraft(template: {
  id: number;
  sportType: string;
  name: string;
  summary: string | null;
  blocks: Array<{
    id: number;
    blockType: string;
    title: string;
    instructions: string | null;
    sortOrder: number;
  }>;
}, scheduledDate: string) {
  return createSessionDraftFromWorkoutContent({
    scheduledDate,
    title: template.name,
    sourceTemplateId: template.id,
    content: createWorkoutContentDraftFromRecord({
      sportType: template.sportType,
      summary: template.summary,
      blocks: template.blocks,
    }),
  }) satisfies SessionDraft;
}

export function templateRecordToDraft(template: {
  sportType: string;
  name: string;
  summary: string | null;
  blocks: Array<{
    id: number;
    blockType: string;
    title: string;
    instructions: string | null;
    sortOrder: number;
  }>;
}) {
  return createTemplateDraftFromWorkoutContent({
    name: template.name,
    content: createWorkoutContentDraftFromRecord({
      sportType: template.sportType,
      summary: template.summary,
      blocks: template.blocks,
    }),
  }) satisfies TemplateDraft;
}

export function createEmptySessionDraft(scheduledDate: string): SessionDraft {
  return createSessionDraftFromWorkoutContent({
    scheduledDate,
    title: '',
    content: createEmptyWorkoutContentDraft(),
  });
}

export function createEmptyTemplateDraft(): TemplateDraft {
  return createTemplateDraftFromWorkoutContent({
    name: '',
    content: createEmptyWorkoutContentDraft(),
  });
}

function toNullableInt(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toNullableFloat(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
