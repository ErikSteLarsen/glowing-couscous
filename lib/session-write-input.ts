import { z } from 'zod';
import type { PlannerSessionDraft } from './planner-draft.ts';
import type { SessionEditorDraft } from './session-editor.ts';
import type { WorkoutTarget } from './workout-targets.ts';

// Transport checks preserve values; domain validators own workout semantics.
const nullableNumber = z.number().nullable();
const weekday = z.literal([1, 2, 3, 4, 5, 6, 7]).nullable();
const kind = z.enum(['warmup', 'work', 'recovery', 'cooldown', 'pause']);
const zone = z.literal([1, 2, 3, 4, 5]);
const metric = z.enum(['power', 'pace', 'hr', 'rpe']);
const mode = z.enum(['absolute', 'relative']);
const reference = z.enum([
  'ftp', 'threshold-pace', 'css', 'threshold-hr', 'max-hr', 'profile-pace',
  'profile-pace-zone-1', 'profile-pace-zone-2', 'profile-pace-zone-3', 'profile-pace-zone-4', 'profile-pace-zone-5',
]).nullable();
const sportMetrics = z.object({ ftp: nullableNumber, thresholdPaceSecPerKm: nullableNumber, thresholdHr: nullableNumber });
const target = z.object({ metric, mode, reference, low: z.number(), high: z.number() }) satisfies z.ZodType<WorkoutTarget>;

export const plannerSessionInput = z.object({
  id: z.number().optional(),
  ownershipMode: z.enum(['coach-library', 'training-plan', 'athlete']),
  athleteId: nullableNumber,
  scheduledDate: z.string().nullable(),
  planWeekday: weekday,
  sport: z.string(), title: z.string(), summary: z.string(), sportMetrics,
  blocks: z.array(z.object({
    clientId: z.string(), id: z.number().optional(), kind, zone,
    durationSec: z.number(), reps: nullableNumber,
    targetType: metric.nullable(), targetMode: mode, targetReference: reference,
    targetLow: nullableNumber, targetHigh: nullableNumber,
    targetLowDecimal: z.string().nullable(), targetHighDecimal: z.string().nullable(),
    note: z.string(), skipped: z.boolean().optional(),
  })),
}) satisfies z.ZodType<PlannerSessionDraft>;

export const sessionEditorInput = z.object({
  mode: z.enum(['create', 'planned', 'actual']),
  id: nullableNumber, athleteId: nullableNumber, coachOwnerId: nullableNumber,
  trainingPlanId: nullableNumber, planId: nullableNumber, templateId: nullableNumber, assignedById: nullableNumber,
  scheduledDate: z.string().nullable(), planWeekday: weekday, timeLabel: z.string().nullable(),
  sport: z.string(), title: z.string(), summary: z.string(), coachNotes: z.string(), athleteNotes: z.string(),
  rpe: nullableNumber, sportMetrics, status: z.string(), source: z.string(), adjusted: z.boolean(),
  blocks: z.array(z.object({
    clientId: z.string(), id: nullableNumber, kind, zone, durationSec: z.number(), reps: nullableNumber,
    target: target.nullable(), note: z.string(), skipped: z.boolean(),
  })),
}) satisfies z.ZodType<SessionEditorDraft>;

export const trainingPlanInput = z.object({
  name: z.string(), sport: z.string(), summary: z.string().nullable().optional(),
});
