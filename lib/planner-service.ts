import { endOfWeek, format, startOfWeek } from 'date-fns';
import { prisma } from './prisma.ts';
import { normalizeSessionDraft, validateSessionDraft } from './planner.ts';

type PlannerServiceDeps = {
  db?: typeof prisma;
};

type PlannerWeekRef = {
  athleteId: number;
  weekStart: Date | string;
};

type PlannerCommand =
  | { type: 'save-session'; sessionId?: number; draft: unknown }
  | { type: 'delete-session'; sessionId: number };

type PlannerResult =
  | { ok: true; sessionId?: number }
  | { ok: false; error: string; status?: number };

export function createPlannerService({ db = prisma }: PlannerServiceDeps = {}) {
  return {
    forWeek(ref: PlannerWeekRef) {
      const athleteId = Number(ref.athleteId);

      return {
        async execute(command: PlannerCommand): Promise<PlannerResult> {
          switch (command.type) {
            case 'save-session':
              return saveSession({ db, athleteId, command });
            case 'delete-session':
              return deleteSession({ db, athleteId, command });
            default:
              return { ok: false, error: 'Unsupported planner command', status: 400 };
          }
        },
      };
    },
  };
}

export const plannerService = createPlannerService();

async function saveSession({
  db,
  athleteId,
  command,
}: {
  db: typeof prisma;
  athleteId: number;
  command: Extract<PlannerCommand, { type: 'save-session' }>;
}): Promise<PlannerResult> {
  const draft = normalizeSessionDraft(command.draft);
  const validationError = validateSessionDraft(draft);

  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const scheduledDate = new Date(draft.scheduledDate);
  if (Number.isNaN(scheduledDate.getTime())) {
    return { ok: false, error: 'A valid scheduled date is required.', status: 400 };
  }

  const scheduledWeekStart = startOfWeek(scheduledDate, { weekStartsOn: 1 });
  const weekPlan = await ensureWeekPlan(db, athleteId, scheduledWeekStart);

  const blockCreates = mapDraftBlocksToTempoBlocks(draft.blocks, draft.durationMinutes);
  const data = {
    athleteId,
    planId: weekPlan.id,
    templateId: null,
    date: scheduledDate,
    timeLabel: null as string | null,
    sport: draft.sportType,
    title: draft.title,
    summary: draft.summary || null,
    status: 'planned',
    source: 'coach',
  };

  if (!command.sessionId) {
    const created = await db.session.create({
      data: {
        ...data,
        adjusted: false,
        blocks: {
          create: blockCreates,
        },
      },
    });

    return { ok: true, sessionId: created.id };
  }

  const existing = await db.session.findUnique({
    where: { id: command.sessionId },
    select: { id: true, athleteId: true, adjusted: true, activity: { select: { id: true } } },
  });

  if (!existing || existing.athleteId !== athleteId) {
    return { ok: false, error: 'Workout not found.', status: 404 };
  }
  if (existing.activity) {
    return { ok: false, error: 'Workouts marked as done can’t be changed.', status: 409 };
  }

  await db.$transaction([
    db.block.deleteMany({ where: { sessionId: command.sessionId } }),
    db.session.update({
      where: { id: command.sessionId },
      data: {
        ...data,
        adjusted: existing.adjusted,
        blocks: {
          create: blockCreates,
        },
      },
    }),
  ]);

  return { ok: true, sessionId: command.sessionId };
}

async function deleteSession({
  db,
  athleteId,
  command,
}: {
  db: typeof prisma;
  athleteId: number;
  command: Extract<PlannerCommand, { type: 'delete-session' }>;
}): Promise<PlannerResult> {
  const session = await db.session.findUnique({
    where: { id: command.sessionId },
    select: { id: true, athleteId: true, activity: { select: { id: true } } },
  });

  if (!session || session.athleteId !== athleteId) {
    return { ok: false, error: 'Workout not found.', status: 404 };
  }
  if (session.activity) {
    return { ok: false, error: 'Workouts marked as done can’t be changed.', status: 409 };
  }

  await db.session.delete({ where: { id: command.sessionId } });
  return { ok: true, sessionId: command.sessionId };
}

async function findWeekPlan(db: typeof prisma, athleteId: number, weekStart: Date) {
  return db.plan.findFirst({
    where: {
      athleteId,
      startDate: weekStart,
      endDate: endOfWeek(weekStart, { weekStartsOn: 1 }),
    },
    orderBy: { id: 'desc' },
  });
}

async function ensureWeekPlan(db: typeof prisma, athleteId: number, weekStart: Date) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const existing = await findWeekPlan(db, athleteId, weekStart);
  if (existing) {
    return existing;
  }

  return db.plan.create({
    data: {
      athleteId,
      name: `Week of ${format(weekStart, 'd MMM yyyy')}`,
      startDate: weekStart,
      endDate: weekEnd,
    },
  });
}

function mapDraftBlocksToTempoBlocks(
  blocks: Array<{ blockType: string; title: string; instructions: string; sortOrder: number }>,
  durationMinutes: number | null,
) {
  const totalDurationSec = Math.max(0, (durationMinutes ?? 0) * 60);
  const fallbackDurationSec = blocks.length > 0 ? Math.floor(totalDurationSec / blocks.length) : 0;

  return blocks.map((block, index) => ({
    kind: tempoKindFromLegacy(block.blockType),
    zone: tempoZoneFromLegacy(block.blockType),
    durationSec:
      index === blocks.length - 1
        ? Math.max(
            fallbackDurationSec || 600,
            totalDurationSec - fallbackDurationSec * Math.max(0, blocks.length - 1),
          )
        : fallbackDurationSec || 600,
    reps: block.blockType === 'REPS' ? 4 : null,
    targetType: null,
    targetLow: null,
    targetHigh: null,
    note: [block.title.trim(), block.instructions.trim()].filter(Boolean).join('\n') || null,
    sortOrder: index,
  }));
}

function tempoKindFromLegacy(blockType: string) {
  if (blockType === 'WARMUP') return 'warmup';
  if (blockType === 'COOLDOWN') return 'cooldown';
  if (blockType === 'REST') return 'recovery';
  return 'work';
}

function tempoZoneFromLegacy(blockType: string) {
  if (blockType === 'WARMUP' || blockType === 'COOLDOWN') return 1;
  if (blockType === 'REST') return 2;
  if (blockType === 'INTERVALS' || blockType === 'REPS') return 4;
  return 3;
}
