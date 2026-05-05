import { addDays, endOfDay, endOfWeek, formatISO, startOfDay, startOfWeek, subWeeks } from 'date-fns';
import { prisma } from '@/lib/prisma';
import { normalizeSessionDraft, validateSessionDraft } from '@/lib/planner';

type PlannerServiceDeps = {
  db?: typeof prisma;
  now?: () => Date;
};

type PlannerWeekRef = {
  athleteId: number;
  weekStart: Date | string;
};

type PlannerLoadOptions = {
  includeTemplates?: boolean;
  includePreviousWeekPrefill?: boolean;
};

type PlannerCommand =
  | { type: 'save-session'; sessionId?: number; draft: unknown }
  | { type: 'delete-session'; sessionId: number }
  | { type: 'save-weekly-note'; weeklyNote: string }
  | { type: 'copy-previous-week' }
  | { type: 'set-session-completion'; sessionId: number; athleteUserId: number; isDone: boolean; notes?: string };

type PlannerResult =
  | { ok: true; sessionId?: number; completion?: { isDone: boolean; notes: string | null; completedAt: string | null } }
  | { ok: false; error: string; status?: number };

export function createPlannerService({ db = prisma, now = () => new Date() }: PlannerServiceDeps = {}) {
  return {
    forWeek(ref: PlannerWeekRef) {
      const athleteId = Number(ref.athleteId);
      const weekStart = normalizeWeekStart(ref.weekStart);

      return {
        async load(options: PlannerLoadOptions = {}) {
          const athlete = await db.athleteProfile.findUnique({
            where: { id: athleteId },
            include: {
              user: true,
              coach: true,
              planWeeks: {
                where: { weekStart },
                include: {
                  sessions: {
                    where: {
                      scheduledDate: {
                        gte: weekStart,
                        lte: endOfWeek(weekStart, { weekStartsOn: 1 }),
                      },
                    },
                    include: {
                      blocks: {
                        orderBy: { sortOrder: 'asc' },
                      },
                      completion: true,
                      sourceTemplate: true,
                    },
                    orderBy: [{ scheduledDate: 'asc' }, { sortOrder: 'asc' }],
                  },
                },
              },
            },
          });

          if (!athlete) {
            return null;
          }

          const currentWeek = athlete.planWeeks[0] ?? null;
          const templates = options.includeTemplates
            ? await db.sessionTemplate.findMany({
                where: { coachId: athlete.coachId },
                include: {
                  blocks: {
                    orderBy: { sortOrder: 'asc' },
                  },
                },
                orderBy: [{ sportType: 'asc' }, { name: 'asc' }],
              })
            : [];

          const previousWeek = options.includePreviousWeekPrefill
            ? await db.planWeek.findUnique({
                where: {
                  athleteId_weekStart: {
                    athleteId,
                    weekStart: subWeeks(weekStart, 1),
                  },
                },
                include: {
                  sessions: {
                    where: {
                      scheduledDate: {
                        gte: subWeeks(weekStart, 1),
                        lte: endOfWeek(subWeeks(weekStart, 1), { weekStartsOn: 1 }),
                      },
                    },
                    include: {
                      blocks: {
                        orderBy: { sortOrder: 'asc' },
                      },
                    },
                    orderBy: [{ scheduledDate: 'asc' }, { sortOrder: 'asc' }],
                  },
                },
              })
            : null;

          return {
            athlete: {
              profileId: athlete.id,
              userId: athlete.userId,
              name: athlete.user.name,
              coachId: athlete.coachId,
              coachName: athlete.coach.name,
            },
            week: {
              start: isoWeekStart(weekStart),
              previousStart: isoWeekStart(addDays(weekStart, -7)),
              nextStart: isoWeekStart(addDays(weekStart, 7)),
              weeklyNote: currentWeek?.weeklyNote ?? '',
              exists: Boolean(currentWeek),
            },
            sessions: serializeSessions(currentWeek?.sessions ?? []),
            templates: templates.map(serializeTemplate),
            previousWeekSessions: serializeSessions(previousWeek?.sessions ?? []),
          };
        },

        async execute(command: PlannerCommand): Promise<PlannerResult> {
          switch (command.type) {
            case 'save-session':
              return saveSession({ db, athleteId, weekStart, command });
            case 'delete-session':
              return deleteSession({ db, athleteId, command });
            case 'save-weekly-note':
              return saveWeeklyNote({ db, athleteId, weekStart, weeklyNote: command.weeklyNote });
            case 'copy-previous-week':
              return copyPreviousWeek({ db, athleteId, weekStart });
            case 'set-session-completion':
              return setSessionCompletion({ db, athleteId, now, command });
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
  weekStart,
  command,
}: {
  db: typeof prisma;
  athleteId: number;
  weekStart: Date;
  command: Extract<PlannerCommand, { type: 'save-session' }>;
}): Promise<PlannerResult> {
  const draft = normalizeSessionDraft(command.draft);
  const validationError = validateSessionDraft(draft);

  if (validationError) {
    return { ok: false, error: validationError, status: 400 };
  }

  const planWeek = await db.planWeek.upsert({
    where: {
      athleteId_weekStart: {
        athleteId,
        weekStart,
      },
    },
    update: {},
    create: {
      athleteId,
      weekStart,
    },
  });

  const scheduledDate = new Date(draft.scheduledDate);
  const sessionData = {
    planWeekId: planWeek.id,
    scheduledDate,
    sportType: draft.sportType,
    title: draft.title,
    summary: draft.summary || null,
    durationMinutes: draft.durationMinutes,
    distanceKm: draft.distanceKm,
    intensity: draft.intensity || null,
    sourceTemplateId: draft.sourceTemplateId,
  };

  if (!command.sessionId) {
    const sameDayCount = await db.plannedSession.count({
      where: {
        planWeekId: planWeek.id,
        scheduledDate: {
          gte: startOfDay(scheduledDate),
          lte: endOfDay(scheduledDate),
        },
      },
    });

    const created = await db.plannedSession.create({
      data: {
        ...sessionData,
        sortOrder: sameDayCount,
        blocks: {
          create: draft.blocks.map((block, index) => ({
            blockType: block.blockType,
            title: block.title,
            instructions: block.instructions || null,
            sortOrder: index,
          })),
        },
      },
    });

    return { ok: true, sessionId: created.id };
  }

  const existing = await db.plannedSession.findUnique({
    where: { id: command.sessionId },
    include: { planWeek: true },
  });

  if (!existing || existing.planWeek.athleteId !== athleteId) {
    return { ok: false, error: 'Session not found.', status: 404 };
  }

  await db.$transaction([
    db.sessionBlock.deleteMany({ where: { sessionId: command.sessionId } }),
    db.plannedSession.update({
      where: { id: command.sessionId },
      data: {
        ...sessionData,
        blocks: {
          create: draft.blocks.map((block, index) => ({
            blockType: block.blockType,
            title: block.title,
            instructions: block.instructions || null,
            sortOrder: index,
          })),
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
  const session = await db.plannedSession.findUnique({
    where: { id: command.sessionId },
    include: { planWeek: true },
  });

  if (!session || session.planWeek.athleteId !== athleteId) {
    return { ok: false, error: 'Session not found.', status: 404 };
  }

  await db.plannedSession.delete({ where: { id: command.sessionId } });
  return { ok: true, sessionId: command.sessionId };
}

async function saveWeeklyNote({
  db,
  athleteId,
  weekStart,
  weeklyNote,
}: {
  db: typeof prisma;
  athleteId: number;
  weekStart: Date;
  weeklyNote: string;
}): Promise<PlannerResult> {
  await db.planWeek.upsert({
    where: {
      athleteId_weekStart: {
        athleteId,
        weekStart,
      },
    },
    update: {
      weeklyNote: weeklyNote.trim() || null,
    },
    create: {
      athleteId,
      weekStart,
      weeklyNote: weeklyNote.trim() || null,
    },
  });

  return { ok: true };
}

async function copyPreviousWeek({
  db,
  athleteId,
  weekStart,
}: {
  db: typeof prisma;
  athleteId: number;
  weekStart: Date;
}): Promise<PlannerResult> {
  const previousWeekStart = addDays(weekStart, -7);
  const previousWeek = await db.planWeek.findUnique({
    where: {
      athleteId_weekStart: {
        athleteId,
        weekStart: previousWeekStart,
      },
    },
    include: {
      sessions: {
        include: {
          blocks: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ scheduledDate: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  });

  if (!previousWeek) {
    return { ok: false, error: 'No previous week found to copy.', status: 400 };
  }

  const existingTarget = await db.planWeek.findUnique({
    where: {
      athleteId_weekStart: {
        athleteId,
        weekStart,
      },
    },
    include: {
      sessions: true,
    },
  });

  if (existingTarget?.sessions.length) {
    return { ok: false, error: 'Target week already has sessions. Clear it before copying.', status: 400 };
  }

  const targetWeek = await db.planWeek.upsert({
    where: {
      athleteId_weekStart: {
        athleteId,
        weekStart,
      },
    },
    update: {
      weeklyNote: previousWeek.weeklyNote,
    },
    create: {
      athleteId,
      weekStart,
      weeklyNote: previousWeek.weeklyNote,
    },
  });

  for (const session of previousWeek.sessions) {
    const offsetDays = Math.round((session.scheduledDate.getTime() - previousWeekStart.getTime()) / 86400000);
    await db.plannedSession.create({
      data: {
        planWeekId: targetWeek.id,
        scheduledDate: addDays(weekStart, offsetDays),
        sportType: session.sportType,
        title: session.title,
        summary: session.summary,
        durationMinutes: session.durationMinutes,
        distanceKm: session.distanceKm,
        intensity: session.intensity,
        sourceTemplateId: session.sourceTemplateId,
        sortOrder: session.sortOrder,
        blocks: {
          create: session.blocks.map((block) => ({
            blockType: block.blockType,
            title: block.title,
            instructions: block.instructions,
            sortOrder: block.sortOrder,
          })),
        },
      },
    });
  }

  return { ok: true };
}

async function setSessionCompletion({
  db,
  athleteId,
  now,
  command,
}: {
  db: typeof prisma;
  athleteId: number;
  now: () => Date;
  command: Extract<PlannerCommand, { type: 'set-session-completion' }>;
}): Promise<PlannerResult> {
  const session = await db.plannedSession.findUnique({
    where: { id: command.sessionId },
    include: { planWeek: true },
  });

  if (!session || session.planWeek.athleteId !== athleteId) {
    return { ok: false, error: 'Session not found.', status: 404 };
  }

  const normalizedNotes = typeof command.notes === 'string' ? command.notes.trim() : '';
  const completion = await db.sessionCompletion.upsert({
    where: { sessionId: command.sessionId },
    update: {
      athleteId: command.athleteUserId,
      isDone: command.isDone,
      notes: normalizedNotes || null,
      completedAt: command.isDone ? now() : null,
    },
    create: {
      sessionId: command.sessionId,
      athleteId: command.athleteUserId,
      isDone: command.isDone,
      notes: normalizedNotes || null,
      completedAt: command.isDone ? now() : null,
    },
  });

  return {
    ok: true,
    sessionId: command.sessionId,
    completion: {
      isDone: completion.isDone,
      notes: completion.notes,
      completedAt: completion.completedAt ? completion.completedAt.toISOString() : null,
    },
  };
}

function normalizeWeekStart(input: Date | string) {
  const parsed = input instanceof Date ? input : new Date(input);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return startOfWeek(safeDate, { weekStartsOn: 1 });
}

function isoWeekStart(date: Date) {
  return formatISO(startOfWeek(date, { weekStartsOn: 1 }), { representation: 'date' });
}

function serializeSessions(
  sessions: Array<{
    id: number;
    scheduledDate: Date;
    sportType: string;
    title: string;
    summary: string | null;
    durationMinutes: number | null;
    distanceKm: number | null;
    intensity: string | null;
    sourceTemplateId: number | null;
    blocks: Array<{
      id: number;
      blockType: string;
      title: string;
      instructions: string | null;
      sortOrder: number;
    }>;
    completion?: {
      isDone: boolean;
      notes: string | null;
      completedAt: Date | null;
    } | null;
  }>,
) {
  return sessions.map((session) => ({
    id: session.id,
    scheduledDate: session.scheduledDate.toISOString(),
    sportType: session.sportType,
    title: session.title,
    summary: session.summary,
    durationMinutes: session.durationMinutes,
    distanceKm: session.distanceKm,
    intensity: session.intensity,
    sourceTemplateId: session.sourceTemplateId,
    blocks: session.blocks.map((block) => ({
      id: block.id,
      blockType: block.blockType,
      title: block.title,
      instructions: block.instructions,
      sortOrder: block.sortOrder,
    })),
    completion: session.completion
      ? {
          isDone: session.completion.isDone,
          notes: session.completion.notes,
          completedAt: session.completion.completedAt ? session.completion.completedAt.toISOString() : null,
        }
      : null,
  }));
}

function serializeTemplate(template: {
  id: number;
  sportType: string;
  name: string;
  summary: string | null;
  blocks: Array<{
    id: number;
    blockType: string;
    title: string;
    instructions: string | null;
    sortOrder: number;
  }>;
}) {
  return {
    id: template.id,
    sportType: template.sportType,
    name: template.name,
    summary: template.summary,
    blocks: template.blocks.map((block) => ({
      id: block.id,
      blockType: block.blockType,
      title: block.title,
      instructions: block.instructions,
      sortOrder: block.sortOrder,
    })),
  };
}
