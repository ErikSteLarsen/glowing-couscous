import { z } from 'zod';

import { parseTemplateRoutine, routineSelectionSchema, type RoutineEntry } from './template-routine.ts';
import { prisma } from './prisma.ts';
import { getBuiltInPlan } from './plan-catalog/index.ts';
import { workoutCatalog } from './workout-catalog/index.ts';
import { findCatalogWorkout } from './workout-catalog/query.ts';
import { catalogWorkoutToSourceEntry } from './workout-catalog/session.ts';
import { createSessionEditorDraftFromPersisted, serializeSessionEditorDraft, createSessionEditorBlockData } from './session-editor.ts';

const routineSelectionsSchema = z.array(routineSelectionSchema);

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
      if (!Array.isArray(draft.entries) || !draft.entries.length || draft.entries.length > 70) return { error: 'Add between 1 and 70 workouts.' };
      const selections = routineSelectionsSchema.safeParse(draft.entries);
      if (!selections.success) return { error: 'Choose a workout and a day for every entry.' };
      if (templateId !== undefined && (!Number.isSafeInteger(templateId) || templateId <= 0)) return { error: 'Training plan not found.' };
      return db.$transaction(async tx => {
        if (templateId !== undefined && !await tx.template.findFirst({ where: { id: templateId, ownerId } })) return { error: 'Training plan not found.' };
        const workouts = await tx.session.findMany({
          where: { id: { in: selections.data.flatMap(entry => entry.workoutId === undefined ? [] : [entry.workoutId]) }, athleteId: ownerId, coachOwnerId: null, date: null, planId: null, trainingPlanId: null },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        });
        const entries: RoutineEntry[] = [];
        for (const selection of selections.data) {
          if (selection.catalogWorkoutSlug !== undefined) {
            const workout = findCatalogWorkout(workoutCatalog, selection.catalogWorkoutSlug);
            if (!workout) return { error: 'One of these public workouts is unavailable. Choose another workout.' };
            entries.push({ ...selection, ...catalogWorkoutToSourceEntry(workout) });
            continue;
          }
          const workout = workouts.find(item => item.id === selection.workoutId);
          if (!workout || !workout.blocks.length) return { error: 'One of these workouts was deleted. Choose another from My workouts.' };
          entries.push({
            ...selection,
            ...(workout.catalogWorkoutSlug ? { sourceCatalogWorkoutSlug: workout.catalogWorkoutSlug } : {}),
            title: workout.title, sport: workout.sport, summary: workout.summary,
            sportMetricsJson: workout.sportMetricsJson,
            blocks: createSessionEditorBlockData(serializeSessionEditorDraft(createSessionEditorDraftFromPersisted('create', workout)).blocks),
          });
        }
        const data = { name, summary: summary || null, routineJson: JSON.stringify({ version: 1, entries }) };
        if (templateId === undefined) {
          const plan = typeof draft.catalogPlanSlug === 'string' ? getBuiltInPlan(draft.catalogPlanSlug) : undefined;
          await tx.template.create({
            data: { ...data, ownerId, catalogPlanSlug: plan?.slug, catalogPlanVersion: plan?.version },
          });
        } else {
          await tx.template.update({ where: { id: templateId }, data });
        }
        return { error: null };
      });
    },

    async deleteForOwner(ownerId: number, templateId: number) {
      const template = await db.template.findFirst({ where: { id: templateId, ownerId } });
      if (!template) return { error: 'Training plan not found.' };
      await db.template.delete({ where: { id: templateId } });
      return { error: null };
    },
    async duplicateForOwner(ownerId: number, templateId: number) {
      const template = await db.template.findFirst({ where: { id: templateId, ownerId } });
      if (!template) return { error: 'Training plan not found.' };
      if (!parseTemplateRoutine(template.routineJson)) return { error: 'This training plan can’t be read. Edit it and save again.' };
      await db.template.create({ data: {
        ownerId,
        name: `${template.name} (Copy)`,
        summary: template.summary,
        routineJson: template.routineJson,
        catalogPlanSlug: template.catalogPlanSlug,
        catalogPlanVersion: template.catalogPlanVersion,
      } });
      return { error: null };
    },
  };
}
export const templateService = createTemplateService();
