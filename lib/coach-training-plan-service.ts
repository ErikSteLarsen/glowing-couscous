import { plannerSessionInput, trainingPlanInput } from './session-write-input.ts';
import { createSessionEditorBlockData } from './session-editor.ts';
import { prisma } from './prisma.ts';
import { serializePlannerDraftForSave, validatePlannerSessionDraft } from './planner-draft.ts';

export function createCoachTrainingPlanService({ db = prisma }: { db?: typeof prisma } = {}) {
  return {
    async createPlan(coachId: number, input: unknown) {
      const parsed = trainingPlanInput.safeParse(input);
      if (!parsed.success) return { ok: false as const, status: 400, error: 'Invalid training plan.' };
      const plan = await db.trainingPlan.create({
        data: {
          coachOwnerId: coachId,
          name: parsed.data.name.trim(),
          summary: parsed.data.summary?.trim() || null,
          sport: parsed.data.sport,
        },
      });
      return { ok: true as const, planId: plan.id };
    },

    async updatePlan(
      coachId: number,
      trainingPlanId: number,
      input: unknown,
    ) {
      const parsed = trainingPlanInput.safeParse(input);
      if (!parsed.success) return { ok: false as const, status: 400, error: 'Invalid training plan.' };
      const existing = await db.trainingPlan.findFirst({
        where: { id: trainingPlanId, coachOwnerId: coachId },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: 'Training plan not found.', status: 404 };

      await db.trainingPlan.update({
        where: { id: trainingPlanId },
        data: {
          name: parsed.data.name.trim(),
          summary: parsed.data.summary?.trim() || null,
          sport: parsed.data.sport,
        },
      });
      return { ok: true as const, planId: trainingPlanId };
    },

    async deletePlan(coachId: number, trainingPlanId: number) {
      const existing = await db.trainingPlan.findFirst({
        where: { id: trainingPlanId, coachOwnerId: coachId },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: 'Training plan not found.', status: 404 };

      await db.trainingPlan.delete({ where: { id: trainingPlanId } });
      return { ok: true as const, planId: trainingPlanId };
    },

    async savePlanSession(
      coachId: number,
      trainingPlanId: number,
      input: unknown,
      sessionId?: number,
    ) {
      const parsed = plannerSessionInput.safeParse(input);
      if (!parsed.success) return { ok: false as const, status: 400, error: 'Invalid session draft.' };
      const draft = parsed.data;
      const validationError = validatePlannerSessionDraft(draft);
      if (validationError) return { ok: false as const, error: validationError, status: 400 };

      const plan = await db.trainingPlan.findFirst({
        where: { id: trainingPlanId, coachOwnerId: coachId },
        select: { id: true },
      });
      if (!plan) return { ok: false as const, error: 'Training plan not found.', status: 404 };

      const serialized = serializePlannerDraftForSave(draft);
      const data = {
        coachOwnerId: coachId,
        athleteId: null,
        trainingPlanId,
        date: null,
        planWeekday: serialized.planWeekday,
        sport: serialized.sport,
        title: serialized.title,
        summary: serialized.summary || null,
        sportMetricsJson: JSON.stringify(serialized.sportMetrics),
        templateId: null,
        source: 'training-plan',
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

      const existingSession = await db.session.findFirst({
        where: { id: sessionId, coachOwnerId: coachId, trainingPlanId },
        select: { id: true },
      });
      if (!existingSession) return { ok: false as const, error: 'Training-plan session not found.', status: 404 };

      await db.$transaction([
        db.block.deleteMany({ where: { sessionId } }),
        db.session.update({ where: { id: sessionId }, data }),
      ]);
      return { ok: true as const, sessionId };
    },

    async deletePlanSession(coachId: number, trainingPlanId: number, sessionId: number) {
      const existing = await db.session.findFirst({
        where: {
          id: sessionId,
          coachOwnerId: coachId,
          trainingPlanId,
          athleteId: null,
        },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: 'Training-plan session not found.', status: 404 };

      await db.session.delete({ where: { id: sessionId } });
      return { ok: true as const, sessionId };
    },
  };
}

export const coachTrainingPlanService = createCoachTrainingPlanService();
