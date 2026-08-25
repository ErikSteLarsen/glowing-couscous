import { deriveSessionMetrics } from './session-math.ts';
import { prisma } from './prisma.ts';
import { createSessionSnapshotJson } from './session-snapshot-service.ts';

const MAX_NOTES_LENGTH = 2000;

type CompletionDatabase = typeof prisma;

export type CompletionInput = { notes?: string };

export type CompletionResult =
  | { ok: true; sessionId: number; isDone: boolean; notes: string; completedAt: Date | null }
  | { ok: false; status: 400 | 404; error: string };

export function createAthleteCompletionService({ db = prisma }: { db?: CompletionDatabase } = {}) {
  function normalizeNotes(input: CompletionInput): string | null | 'invalid' {
    if (input.notes === undefined) return null;
    const notes = input.notes.trim();
    if (notes.length > MAX_NOTES_LENGTH) return 'invalid';
    return notes || null;
  }

  async function loadSession(athleteId: number, sessionId: number) {
    return db.session.findUnique({
      where: { id: sessionId },
      include: {
        blocks: { orderBy: { sortOrder: 'asc' } },
        activity: true,
      },
    }).then((session) => (session && session.athleteId === athleteId ? session : null));
  }

  return {
    async completeSession(athleteId: number, sessionId: number, input: CompletionInput): Promise<CompletionResult> {
      const notes = normalizeNotes(input);
      if (notes === 'invalid') return { ok: false, status: 400, error: 'Notes are too long' };

      const session = await loadSession(athleteId, sessionId);
      if (!session) return { ok: false, status: 404, error: 'Session not found' };

      const retainedNotes = notes ?? session.activity?.notes ?? session.athleteNotes ?? null;
      const completedAt = session.activity?.completedAt ?? new Date();
      const metrics = deriveSessionMetrics(
        session.blocks.map((block) => ({
          kind: block.kind as 'warmup' | 'work' | 'recovery' | 'cooldown',
          zone: block.zone as 1 | 2 | 3 | 4 | 5,
          durationSec: block.durationSec,
          reps: block.reps,
          target:
            block.targetType && block.targetLow !== null && block.targetHigh !== null
              ? {
                  type: block.targetType as 'power' | 'pace' | 'hr',
                  low: block.targetLow,
                  high: block.targetHigh,
                }
              : null,
        })),
      );
      const actualSnapshotJson = createSessionSnapshotJson({
        id: session.id,
        athleteId: session.athleteId,
        scheduledDate: session.date,
        timeLabel: session.timeLabel,
        sport: session.sport,
        title: session.title,
        summary: session.summary,
        coachNotes: session.coachNotes,
        athleteNotes: retainedNotes,
        rpe: session.rpe ?? null,
        sportMetricsJson: session.sportMetricsJson,
        status: 'completed',
        source: session.source,
        adjusted: session.adjusted,
        blocks: session.blocks,
      });

      await db.$transaction([
        db.activity.upsert({
          where: { sessionId: session.id },
          update: {
            completedAt,
            notes: retainedNotes,
            actualSnapshotJson,
            rpe: session.rpe ?? null,
          },
          create: {
            sessionId: session.id,
            athleteId,
            completedAt,
            durationSec: metrics.durationSec,
            tss: metrics.tss,
            compliancePct: null,
            zoneDistributionJson: JSON.stringify(metrics.zoneDistributionSec),
            segmentsJson: JSON.stringify(metrics.segments),
            metricsSource: 'manual-planned',
            notes: retainedNotes,
            actualSnapshotJson,
            rpe: session.rpe ?? null,
          },
        }),
        db.session.update({
          where: { id: session.id },
          data: { status: 'completed', athleteNotes: retainedNotes },
        }),
      ]);

      return {
        ok: true,
        sessionId: session.id,
        isDone: true,
        notes: retainedNotes ?? '',
        completedAt,
      };
    },

    async reopenSession(athleteId: number, sessionId: number, input: CompletionInput): Promise<CompletionResult> {
      const notes = normalizeNotes(input);
      if (notes === 'invalid') return { ok: false, status: 400, error: 'Notes are too long' };

      const session = await loadSession(athleteId, sessionId);
      if (!session) return { ok: false, status: 404, error: 'Session not found' };

      const retainedNotes = notes ?? session.activity?.notes ?? session.athleteNotes ?? null;
      await db.$transaction([
        ...(session.activity ? [db.activity.delete({ where: { sessionId: session.id } })] : []),
        db.session.update({
          where: { id: session.id },
          data: { status: 'planned', athleteNotes: retainedNotes },
        }),
      ]);

      return { ok: true, sessionId: session.id, isDone: false, notes: retainedNotes ?? '', completedAt: null };
    },
  };
}

export const athleteCompletionService = createAthleteCompletionService();
