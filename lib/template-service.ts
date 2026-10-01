import { type RoutineEntry, parseTemplateRoutine } from './template-routine.ts';
import { prisma } from './prisma.ts';
import { createSessionEditorDraftFromPersisted, serializeSessionEditorDraft, createSessionEditorBlockData } from './session-editor.ts';

export function createTemplateService({ db = prisma }: { db?: typeof prisma } = {}) {
  return {
    async listForOwner(ownerId: number) {
      return db.template.findMany({ where: { ownerId }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    },
    async saveForOwner(ownerId: number, input: unknown, templateId?: number) {
      const draft = (input ?? {}) as Record<string, unknown>;
      const name = typeof draft.name === 'string' ? draft.name.trim() : '';
      const summary = typeof draft.summary === 'string' ? draft.summary.trim() : '';
      if (!name || name.length > 160 || summary.length > 2000) return { error: 'Enter a name (up to 160 characters) and a description up to 2,000 characters.' };
      if (!Array.isArray(draft.entries) || !draft.entries.length || draft.entries.length > 70) return { error: 'Add between 1 and 70 saved workouts.' };
      const selections = draft.entries as Array<{ weekday: number; workoutId: number }>;
      if (selections.some(entry => !entry || !Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6 || !Number.isSafeInteger(entry.workoutId) || entry.workoutId <= 0)) return { error: 'Choose a saved workout and weekday for every session.' };
      if (templateId !== undefined && (!Number.isSafeInteger(templateId) || templateId <= 0)) return { error: 'Template id is invalid.' };
      return db.$transaction(async tx => {
        if (templateId !== undefined && !await tx.template.findFirst({ where: { id: templateId, ownerId } })) return { error: 'Template not found.' };
        const workouts = await tx.session.findMany({
          where: { id: { in: selections.map(entry => entry.workoutId) }, athleteId: ownerId, coachOwnerId: null, date: null, planId: null, trainingPlanId: null },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        });
        const entries: RoutineEntry[] = [];
        for (const selection of selections) {
          const workout = workouts.find(item => item.id === selection.workoutId);
          if (!workout || !workout.blocks.length) return { error: 'A selected workout is unavailable. Choose a workout from your library.' };
          entries.push({ weekday: selection.weekday, workoutId: selection.workoutId, title: workout.title, sport: workout.sport, summary: workout.summary,
            sportMetricsJson: workout.sportMetricsJson,
            blocks: createSessionEditorBlockData(serializeSessionEditorDraft(createSessionEditorDraftFromPersisted('create', workout)).blocks),
          });
        }
        const data = { name, summary: summary || null, routineJson: JSON.stringify({ version: 1, entries }) };
        if (templateId === undefined) await tx.template.create({ data: { ...data, ownerId } });
        else {
          await tx.template.update({ where: { id: templateId }, data });
        }
        return { error: null };
      });
    },


    async deleteForOwner(ownerId: number, templateId: number) {
      const template = await db.template.findFirst({ where: { id: templateId, ownerId } });
      if (!template) return { error: 'Template not found.' };
      await db.template.delete({ where: { id: templateId } });
      return { error: null };
    },
    async duplicateForOwner(ownerId: number, templateId: number) {
      const template = await db.template.findFirst({ where: { id: templateId, ownerId } });
      if (!template) return { error: 'Template not found.' };
      if (!parseTemplateRoutine(template.routineJson)) return { error: 'Template routine is invalid.' };
      await db.template.create({ data: { ownerId, name: `${template.name} (Copy)`, summary: template.summary, routineJson: template.routineJson } });
      return { error: null };
    },
  };
}
export const templateService = createTemplateService();
