import { prisma } from '@/lib/prisma';
import { normalizeTemplateDraft, validateTemplateDraft } from '@/lib/planner';
import { serializeWorkoutBlocksForPersistence } from '@/lib/workout-spec';

type TemplateServiceDeps = {
  db?: typeof prisma;
};

export function createTemplateService({ db = prisma }: TemplateServiceDeps = {}) {
  return {
    async listForCoach(coachId: number) {
      return db.sessionTemplate.findMany({
        where: { coachId },
        include: {
          blocks: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ sportType: 'asc' }, { name: 'asc' }],
      });
    },

    async saveForCoach(coachId: number, draftInput: unknown, templateId?: number) {
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
        await db.sessionTemplate.create({
          data: {
            ...templateData,
            blocks: {
              create: serializeWorkoutBlocksForPersistence(draft.blocks),
            },
          },
        });

        return { error: null };
      }

      const existing = await db.sessionTemplate.findUnique({ where: { id: templateId } });
      if (!existing || existing.coachId !== coachId) {
        return { error: 'Template not found.' };
      }

      await db.$transaction([
        db.sessionTemplateBlock.deleteMany({ where: { templateId } }),
        db.sessionTemplate.update({
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
    },

    async deleteForCoach(coachId: number, templateId: number) {
      const template = await db.sessionTemplate.findUnique({ where: { id: templateId } });
      if (!template || template.coachId !== coachId) {
        return { error: 'Template not found.' };
      }

      await db.sessionTemplate.delete({ where: { id: templateId } });
      return { error: null };
    },

    async duplicateForCoach(coachId: number, templateId: number) {
      const template = await db.sessionTemplate.findUnique({
        where: { id: templateId },
        include: {
          blocks: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      if (!template || template.coachId !== coachId) {
        return { error: 'Template not found.' };
      }

      await db.sessionTemplate.create({
        data: {
          coachId,
          sportType: template.sportType,
          name: `${template.name} (Copy)`,
          summary: template.summary,
          blocks: {
            create: template.blocks.map((block) => ({
              blockType: block.blockType,
              title: block.title,
              instructions: block.instructions,
              sortOrder: block.sortOrder,
            })),
          },
        },
      });

      return { error: null };
    },
  };
}

export const templateService = createTemplateService();
