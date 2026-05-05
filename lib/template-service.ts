import { prisma } from '@/lib/prisma';
import { normalizeTemplateDraft, validateTemplateDraft } from '@/lib/planner';
import { serializeWorkoutBlocksForPersistence } from '@/lib/workout-spec';

export const templateService = {
  async listForCoach(coachId: number) {
    return prisma.sessionTemplate.findMany({
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
  },

  async deleteForCoach(coachId: number, templateId: number) {
    const template = await prisma.sessionTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.coachId !== coachId) {
      return { error: 'Template not found.' };
    }

    await prisma.sessionTemplate.delete({ where: { id: templateId } });
    return { error: null };
  },
};
