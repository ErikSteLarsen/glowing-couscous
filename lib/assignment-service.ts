import { endOfWeek, format, isValid, parseISO, startOfWeek } from 'date-fns';
import { prisma } from './prisma.ts';

type AssignmentCommand = {
  coachId: number;
  athleteId: number;
  templateId: number;
  scheduledDate: string;
};

type AssignmentResult =
  | { ok: true; sessionId: number }
  | { ok: false; error: string; status: number };

type AssignmentTemplateBlock = {
  kind: string;
  zone: number;
  durationSec: number;
  reps: number | null;
  targetType: string | null;
  targetLow: number | null;
  targetHigh: number | null;
  note: string | null;
  sortOrder: number;
};

type AssignmentDb = {
  user: {
    findFirst(args: { where: { id: number; coachId: number; role: string } }): Promise<{ id: number } | null>;
  };
  template: {
    findFirst(args: {
      where: { id: number; ownerId: number };
      include: { blocks: { orderBy: { sortOrder: 'asc' } } };
    }): Promise<{
      id: number;
      ownerId: number;
      sport: string;
      name: string;
      summary: string | null;
      blocks: AssignmentTemplateBlock[];
    } | null>;
  };
  plan: {
    findFirst(args: {
      where: { athleteId: number; startDate: Date; endDate: Date };
      orderBy: { id: 'desc' };
    }): Promise<{ id: number } | null>;
    create(args: {
      data: { athleteId: number; name: string; startDate: Date; endDate: Date };
    }): Promise<{ id: number }>;
  };
  session: {
    findFirst(args: {
      where: {
        athleteId: number;
        templateId: number;
        assignedById: number;
        date: Date;
      };
      select: { id: true };
    }): Promise<{ id: number } | null>;
    create(args: {
      data: {
        athleteId: number;
        planId: number;
        templateId: number;
        assignedById: number;
        date: Date;
        timeLabel: string | null;
        sport: string;
        title: string;
        summary: string | null;
        status: string;
        source: string;
        adjusted: boolean;
        blocks: {
          create: AssignmentTemplateBlock[];
        };
      };
    }): Promise<{ id: number }>;
  };
  assignment: {
    upsert(args: {
      where: { sessionId_athleteId: { sessionId: number; athleteId: number } };
      update: { assignedBy: number; assignedAt: Date };
      create: { sessionId: number; athleteId: number; assignedBy: number; assignedAt: Date };
    }): Promise<unknown>;
  };
};

type AssignmentServiceDeps = {
  db?: AssignmentDb;
  now?: () => Date;
};

function createDefaultDb(): AssignmentDb {
  return {
    user: {
      findFirst(args) {
        return prisma.user.findFirst(args);
      },
    },
    template: {
      findFirst(args) {
        return prisma.template.findFirst(args);
      },
    },
    plan: {
      findFirst(args) {
        return prisma.plan.findFirst(args);
      },
      create(args) {
        return prisma.plan.create(args);
      },
    },
    session: {
      findFirst(args) {
        return prisma.session.findFirst(args);
      },
      create(args) {
        return prisma.session.create(args);
      },
    },
    assignment: {
      upsert(args) {
        return prisma.assignment.upsert(args);
      },
    },
  };
}

export function createAssignmentService({ db = createDefaultDb(), now = () => new Date() }: AssignmentServiceDeps = {}) {
  return {
    async assignTemplateToAthlete(command: AssignmentCommand): Promise<AssignmentResult> {
      const scheduledDate = parseISO(command.scheduledDate);
      if (!isValid(scheduledDate)) {
        return { ok: false, error: 'A valid scheduled date is required.', status: 400 };
      }

      const athlete = await db.user.findFirst({
        where: {
          id: command.athleteId,
          coachId: command.coachId,
          role: 'ATHLETE',
        },
      });

      if (!athlete) {
        return { ok: false, error: 'Athlete not found in your roster.', status: 404 };
      }

      const template = await db.template.findFirst({
        where: {
          id: command.templateId,
          ownerId: command.coachId,
        },
        include: {
          blocks: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!template) {
        return { ok: false, error: 'Template not found.', status: 404 };
      }

      const weekStart = startOfWeek(scheduledDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(scheduledDate, { weekStartsOn: 1 });
      const existingPlan = await db.plan.findFirst({
        where: {
          athleteId: command.athleteId,
          startDate: weekStart,
          endDate: weekEnd,
        },
        orderBy: { id: 'desc' },
      });

      const plan =
        existingPlan ??
        (await db.plan.create({
          data: {
            athleteId: command.athleteId,
            name: `Week of ${format(weekStart, 'd MMM yyyy')}`,
            startDate: weekStart,
            endDate: weekEnd,
          },
        }));

      const existingSession = await db.session.findFirst({
        where: {
          athleteId: command.athleteId,
          templateId: template.id,
          assignedById: command.coachId,
          date: scheduledDate,
        },
        select: { id: true },
      });

      const assignedAt = now();
      if (existingSession) {
        await db.assignment.upsert({
          where: {
            sessionId_athleteId: {
              sessionId: existingSession.id,
              athleteId: command.athleteId,
            },
          },
          update: {
            assignedBy: command.coachId,
            assignedAt,
          },
          create: {
            sessionId: existingSession.id,
            athleteId: command.athleteId,
            assignedBy: command.coachId,
            assignedAt,
          },
        });

        return { ok: true, sessionId: existingSession.id };
      }

      const created = await db.session.create({
        data: {
          athleteId: command.athleteId,
          planId: plan.id,
          templateId: template.id,
          assignedById: command.coachId,
          date: scheduledDate,
          timeLabel: null,
          sport: template.sport,
          title: template.name,
          summary: template.summary,
          status: 'planned',
          source: 'template',
          adjusted: false,
          blocks: {
            create: template.blocks.map((block) => ({
              kind: block.kind,
              zone: block.zone,
              durationSec: block.durationSec,
              reps: block.reps,
              targetType: block.targetType,
              targetLow: block.targetLow,
              targetHigh: block.targetHigh,
              note: block.note,
              sortOrder: block.sortOrder,
            })),
          },
        },
      });

      await db.assignment.upsert({
        where: {
          sessionId_athleteId: {
            sessionId: created.id,
            athleteId: command.athleteId,
          },
        },
        update: {
          assignedBy: command.coachId,
          assignedAt,
        },
        create: {
          sessionId: created.id,
          athleteId: command.athleteId,
          assignedBy: command.coachId,
          assignedAt,
        },
      });

      return { ok: true, sessionId: created.id };
    },
  };
}

export const assignmentService = createAssignmentService();
