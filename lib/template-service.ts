import { prisma } from './prisma.ts';
import { SPORT_OPTIONS } from './sport.ts';

type TemplateServiceDeps = {
  db?: typeof prisma;
};

type NormalizedBlock = {
  kind: 'warmup' | 'work' | 'recovery' | 'cooldown';
  zone: 1 | 2 | 3 | 4 | 5;
  durationSec: number;
  reps: number | null;
  targetType: 'power' | 'pace' | 'hr' | null;
  targetLow: number | null;
  targetHigh: number | null;
  note: string | null;
  skipped: boolean;
};

function mapLegacyBlockType(input: string) {
  switch (input) {
    case 'WARMUP':
      return 'warmup';
    case 'COOLDOWN':
      return 'cooldown';
    case 'REST':
      return 'recovery';
    default:
      return 'work';
  }
}

function normalizeBlocks(input: unknown): NormalizedBlock[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }

  return input.map((block) => {
    const item = (block ?? {}) as Record<string, unknown>;
    const kindSource = typeof item.kind === 'string' ? item.kind : typeof item.blockType === 'string' ? mapLegacyBlockType(item.blockType) : 'work';
    const normalizedKind =
      kindSource === 'warmup' || kindSource === 'work' || kindSource === 'recovery' || kindSource === 'cooldown'
        ? kindSource
        : 'work';
    const zone = Number(item.zone);
    const rawDurationSec =
      item.durationSec ?? (item.durationMinutes != null ? Number(item.durationMinutes) * 60 : 0);
    const durationSec = Number(rawDurationSec);

    return {
      kind: normalizedKind,
      zone: zone >= 1 && zone <= 5 ? (zone as 1 | 2 | 3 | 4 | 5) : 2,
      durationSec: Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec) : 600,
      reps: typeof item.reps === 'number' ? Math.round(item.reps) : null,
      targetType:
        item.targetType === 'power' || item.targetType === 'pace' || item.targetType === 'hr'
          ? item.targetType
          : null,
      targetLow: typeof item.targetLow === 'number' ? Math.round(item.targetLow) : null,
      targetHigh: typeof item.targetHigh === 'number' ? Math.round(item.targetHigh) : null,
      note:
        typeof item.note === 'string'
          ? item.note.trim() || null
          : typeof item.instructions === 'string'
            ? item.instructions.trim() || null
              : typeof item.title === 'string'
                ? item.title.trim() || null
                : null,
      skipped: item.skipped === true,
    };
  });
}

function normalizeTemplateDraft(input: unknown) {
  const draft = (input ?? {}) as Record<string, unknown>;
  const sport = typeof draft.sport === 'string' ? draft.sport : typeof draft.sportType === 'string' ? draft.sportType : '';
  const name = typeof draft.name === 'string' ? draft.name.trim() : '';
  const summary = typeof draft.summary === 'string' ? draft.summary.trim() : '';
  const blocks = normalizeBlocks(draft.blocks);

  if (!name) {
    return { error: 'Template name is required.' as const };
  }

  if (!sport || !SPORT_OPTIONS.includes(sport as (typeof SPORT_OPTIONS)[number])) {
    return { error: 'Sport is required.' as const };
  }

  if (blocks.length === 0) {
    return { error: 'At least one block is required.' as const };
  }

  return {
    error: null,
    draft: {
      name,
      sport,
      summary: summary || null,
      blocks,
    },
  };
}

export function createTemplateService({ db = prisma }: TemplateServiceDeps = {}) {
  const service = {
    async listForOwner(ownerId: number) {
      return db.template.findMany({
        where: { ownerId },
        include: {
          blocks: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ sport: 'asc' }, { name: 'asc' }],
      });
    },

    async saveForOwner(ownerId: number, draftInput: unknown, templateId?: number) {
      const normalized = normalizeTemplateDraft(draftInput);
      if (normalized.error) {
        return { error: normalized.error };
      }

      const templateData = {
        ownerId,
        name: normalized.draft.name,
        sport: normalized.draft.sport,
        summary: normalized.draft.summary,
      };

      if (templateId === undefined) {
        await db.template.create({
          data: {
            ...templateData,
            blocks: {
              create: normalized.draft.blocks.map((block, index) => ({
                ...block,
                sortOrder: index,
              })),
            },
          },
        });

        return { error: null };
      }

      if (!Number.isInteger(templateId) || templateId <= 0) {
        return { error: 'Template id is invalid.' };
      }

      const existing = await db.template.findUnique({ where: { id: templateId } });
      if (!existing || existing.ownerId !== ownerId) {
        return { error: 'Template not found.' };
      }

      await db.$transaction([
        db.block.deleteMany({ where: { templateId } }),
        db.template.update({
          where: { id: templateId },
          data: {
            name: normalized.draft.name,
            sport: normalized.draft.sport,
            summary: normalized.draft.summary,
            blocks: {
              create: normalized.draft.blocks.map((block, index) => ({
                ...block,
                sortOrder: index,
              })),
            },
          },
        }),
      ]);

      return { error: null };
    },

    async deleteForOwner(ownerId: number, templateId: number) {
      const template = await db.template.findUnique({ where: { id: templateId } });
      if (!template || template.ownerId !== ownerId) {
        return { error: 'Template not found.' };
      }

      await db.template.delete({ where: { id: templateId } });
      return { error: null };
    },

    async duplicateForOwner(ownerId: number, templateId: number) {
      const template = await db.template.findUnique({
        where: { id: templateId },
        include: {
          blocks: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      if (!template || template.ownerId !== ownerId) {
        return { error: 'Template not found.' };
      }

      await db.template.create({
        data: {
          ownerId,
          name: `${template.name} (Copy)`,
          sport: template.sport,
          summary: template.summary,
          blocks: {
            create: template.blocks.map((block) => ({
              kind: block.kind,
              zone: block.zone,
              durationSec: block.durationSec,
              reps: block.reps,
              targetType: block.targetType,
              targetLow: block.targetLow,
              targetHigh: block.targetHigh,
              note: block.note,
              skipped: block.skipped,
              sortOrder: block.sortOrder,
            })),
          },
        },
      });

      return { error: null };
    },
  };

  return {
    ...service,
    listForCoach: service.listForOwner,
    saveForCoach: service.saveForOwner,
    deleteForCoach: service.deleteForOwner,
    duplicateForCoach: service.duplicateForOwner,
  };
}

export const templateService = createTemplateService();
