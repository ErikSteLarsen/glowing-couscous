import { createSessionEditorBlockData } from './session-editor.ts';
import { parseISO } from 'date-fns';
import { prisma } from './prisma.ts';
import {
  serializePlannerDraftForSave,
  validatePlannerSessionDraft,
  type PlannerSessionDraft,
} from './planner-draft.ts';

export function createCoachSessionLibraryService({ db = prisma }: { db?: typeof prisma } = {}) {
  return {
    async listForCoach(coachId: number) {
      return db.session.findMany({
        where: {
          coachOwnerId: coachId,
          athleteId: null,
          trainingPlanId: null,
        },
        include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        orderBy: [{ date: 'asc' }, { title: 'asc' }],
      });
    },

    async saveForCoach(coachId: number, draft: PlannerSessionDraft, sessionId?: number) {
      const validationError = validatePlannerSessionDraft(draft);
      if (validationError) {
        return { ok: false as const, error: validationError, status: 400 };
      }

      const serialized = serializePlannerDraftForSave(draft);
      const data = {
        coachOwnerId: coachId,
        athleteId: null,
        trainingPlanId: null,
        date: parseISO(serialized.scheduledDate!),
        planWeekday: null,
        sport: serialized.sport,
        title: serialized.title,
        summary: serialized.summary || null,
        sportMetricsJson: JSON.stringify(serialized.sportMetrics),
        templateId: null,
        source: 'coach-library',
        status: 'planned',
        adjusted: false,
        blocks: {
          create: createSessionEditorBlockData(serialized.blocks),
        },
      };

      if (!sessionId) {
        const created = await db.session.create({ data });
        return { ok: true as const, sessionId: created.id };
      }

      const existing = await db.session.findFirst({
        where: { id: sessionId, coachOwnerId: coachId },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: 'Session not found.', status: 404 };

      await db.$transaction([
        db.block.deleteMany({ where: { sessionId } }),
        db.session.update({ where: { id: sessionId }, data }),
      ]);
      return { ok: true as const, sessionId };
    },

    async deleteForCoach(coachId: number, sessionId: number) {
      const existing = await db.session.findFirst({
        where: {
          id: sessionId,
          coachOwnerId: coachId,
          athleteId: null,
          trainingPlanId: null,
        },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: 'Session not found.', status: 404 };

      await db.session.delete({ where: { id: sessionId } });
      return { ok: true as const, sessionId };
    },
  };
}

export const coachSessionLibraryService = createCoachSessionLibraryService();
