const { PrismaClient } = require('@prisma/client');
const { startOfWeek, addDays, addHours } = require('date-fns');

const prisma = new PrismaClient();

const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

async function main() {
  await prisma.sessionCompletion.deleteMany();
  await prisma.sessionBlock.deleteMany();
  await prisma.plannedSession.deleteMany();
  await prisma.sessionTemplateBlock.deleteMany();
  await prisma.sessionTemplate.deleteMany();
  await prisma.planWeek.deleteMany();
  await prisma.athleteProfile.deleteMany();
  await prisma.user.deleteMany();

  const coach = await prisma.user.create({
    data: {
      email: 'coach@demo.local',
      name: 'Coach Ingrid',
      role: 'COACH',
    },
  });

  const [athleteOneUser, athleteTwoUser] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'maria@demo.local',
        name: 'Maria Solberg',
        role: 'ATHLETE',
      },
    }),
    prisma.user.create({
      data: {
        email: 'anders@demo.local',
        name: 'Anders Vik',
        role: 'ATHLETE',
      },
    }),
  ]);

  const [athleteOne, athleteTwo] = await Promise.all([
    prisma.athleteProfile.create({
      data: {
        userId: athleteOneUser.id,
        coachId: coach.id,
      },
    }),
    prisma.athleteProfile.create({
      data: {
        userId: athleteTwoUser.id,
        coachId: coach.id,
      },
    }),
  ]);

  const [tempoTemplate, strengthTemplate] = await Promise.all([
    prisma.sessionTemplate.create({
      data: {
        coachId: coach.id,
        sportType: 'RUNNING',
        name: 'Tempo Builder',
        summary: 'Short threshold session for controlled quality work.',
        blocks: {
          create: [
            { blockType: 'WARMUP', title: 'Easy warmup', instructions: '15 min easy + 4 strides', sortOrder: 0 },
            { blockType: 'MAIN_SET', title: 'Tempo set', instructions: '3 x 8 min steady threshold, 2 min jog between', sortOrder: 1 },
            { blockType: 'COOLDOWN', title: 'Cooldown', instructions: '10 min easy jog', sortOrder: 2 },
          ],
        },
      },
    }),
    prisma.sessionTemplate.create({
      data: {
        coachId: coach.id,
        sportType: 'STRENGTH',
        name: 'General Strength',
        summary: 'Foundational lower-body and trunk session.',
        blocks: {
          create: [
            { blockType: 'WARMUP', title: 'Prep', instructions: '8 min dynamic mobility', sortOrder: 0 },
            { blockType: 'REPS', title: 'Main lifts', instructions: '3 rounds: split squat, RDL, calf raise, plank', sortOrder: 1 },
            { blockType: 'COOLDOWN', title: 'Reset', instructions: '5 min easy mobility', sortOrder: 2 },
          ],
        },
      },
    }),
  ]);

  const [weekOne, weekTwo] = await Promise.all([
    prisma.planWeek.create({
      data: {
        athleteId: athleteOne.id,
        weekStart,
        weeklyNote: 'Focus on consistent aerobic work this week. Keep Tuesday controlled and arrive fresh for the weekend long session.',
      },
    }),
    prisma.planWeek.create({
      data: {
        athleteId: athleteTwo.id,
        weekStart,
        weeklyNote: 'Reduced load week. Prioritize technique in the pool and keep strength work crisp but short.',
      },
    }),
  ]);

  const mariaSessions = await Promise.all([
    prisma.plannedSession.create({
      data: {
        planWeekId: weekOne.id,
        scheduledDate: addHours(addDays(weekStart, 0), 7),
        sportType: 'RUNNING',
        title: 'Easy aerobic run',
        summary: 'Comfortable effort, keep it conversational.',
        durationMinutes: 50,
        intensity: 'Easy',
        sortOrder: 0,
        blocks: {
          create: [
            { blockType: 'WARMUP', title: 'Settle in', instructions: '10 min very easy', sortOrder: 0 },
            { blockType: 'MAIN_SET', title: 'Aerobic run', instructions: '35 min steady easy running', sortOrder: 1 },
            { blockType: 'COOLDOWN', title: 'Finish relaxed', instructions: '5 min walk and light stretch', sortOrder: 2 },
          ],
        },
      },
    }),
    prisma.plannedSession.create({
      data: {
        planWeekId: weekOne.id,
        scheduledDate: addHours(addDays(weekStart, 1), 17),
        sportType: 'RUNNING',
        title: tempoTemplate.name,
        summary: tempoTemplate.summary,
        durationMinutes: 60,
        intensity: 'Moderate',
        sortOrder: 0,
        sourceTemplateId: tempoTemplate.id,
        blocks: {
          create: [
            { blockType: 'WARMUP', title: 'Easy warmup', instructions: '15 min easy + 4 strides', sortOrder: 0 },
            { blockType: 'MAIN_SET', title: 'Tempo set', instructions: '3 x 8 min steady threshold, 2 min jog between', sortOrder: 1 },
            { blockType: 'COOLDOWN', title: 'Cooldown', instructions: '10 min easy jog', sortOrder: 2 },
          ],
        },
      },
    }),
    prisma.plannedSession.create({
      data: {
        planWeekId: weekOne.id,
        scheduledDate: addHours(addDays(weekStart, 3), 18),
        sportType: 'STRENGTH',
        title: strengthTemplate.name,
        summary: strengthTemplate.summary,
        durationMinutes: 40,
        intensity: 'Steady',
        sortOrder: 0,
        sourceTemplateId: strengthTemplate.id,
        blocks: {
          create: [
            { blockType: 'WARMUP', title: 'Prep', instructions: '8 min dynamic mobility', sortOrder: 0 },
            { blockType: 'REPS', title: 'Main lifts', instructions: '3 rounds: split squat, RDL, calf raise, plank', sortOrder: 1 },
            { blockType: 'COOLDOWN', title: 'Reset', instructions: '5 min easy mobility', sortOrder: 2 },
          ],
        },
      },
    }),
    prisma.plannedSession.create({
      data: {
        planWeekId: weekOne.id,
        scheduledDate: addHours(addDays(weekStart, 5), 9),
        sportType: 'RUNNING',
        title: 'Long run',
        summary: 'Build time on feet. Keep fuel and pacing disciplined.',
        durationMinutes: 95,
        intensity: 'Easy to steady',
        sortOrder: 0,
        blocks: {
          create: [
            { blockType: 'WARMUP', title: 'Start easy', instructions: '15 min relaxed', sortOrder: 0 },
            { blockType: 'MAIN_SET', title: 'Long aerobic block', instructions: '70 min mostly easy, last 10 min steady if feeling good', sortOrder: 1 },
            { blockType: 'COOLDOWN', title: 'Reset', instructions: '10 min easy walk + stretch', sortOrder: 2 },
          ],
        },
      },
    }),
  ]);

  const andersSessions = await Promise.all([
    prisma.plannedSession.create({
      data: {
        planWeekId: weekTwo.id,
        scheduledDate: addHours(addDays(weekStart, 0), 6),
        sportType: 'SWIMMING',
        title: 'Technique swim',
        summary: 'Low-stress pool session focused on feel for water.',
        durationMinutes: 45,
        intensity: 'Easy',
        sortOrder: 0,
        blocks: {
          create: [
            { blockType: 'WARMUP', title: 'Warmup', instructions: '300 m easy + drills', sortOrder: 0 },
            { blockType: 'MAIN_SET', title: 'Technique set', instructions: '8 x 50 m drill/swim by 25', sortOrder: 1 },
            { blockType: 'COOLDOWN', title: 'Cooldown', instructions: '200 m easy', sortOrder: 2 },
          ],
        },
      },
    }),
    prisma.plannedSession.create({
      data: {
        planWeekId: weekTwo.id,
        scheduledDate: addHours(addDays(weekStart, 2), 17),
        sportType: 'BIKING',
        title: 'Cadence spin',
        summary: 'Short ride with controlled cadence changes.',
        durationMinutes: 60,
        intensity: 'Easy',
        sortOrder: 0,
        blocks: {
          create: [
            { blockType: 'WARMUP', title: 'Easy spin', instructions: '15 min relaxed', sortOrder: 0 },
            { blockType: 'INTERVALS', title: 'Cadence work', instructions: '6 x 3 min high cadence, 2 min easy between', sortOrder: 1 },
            { blockType: 'COOLDOWN', title: 'Spin down', instructions: '10 min easy', sortOrder: 2 },
          ],
        },
      },
    }),
    prisma.plannedSession.create({
      data: {
        planWeekId: weekTwo.id,
        scheduledDate: addHours(addDays(weekStart, 4), 7),
        sportType: 'STRETCHING',
        title: 'Mobility reset',
        summary: 'Short movement session to stay fresh.',
        durationMinutes: 20,
        intensity: 'Light',
        sortOrder: 0,
        blocks: {
          create: [
            { blockType: 'NOTE', title: 'Mobility flow', instructions: '20 min hips, thoracic rotation, calves, and hamstrings', sortOrder: 0 },
          ],
        },
      },
    }),
  ]);

  await prisma.sessionCompletion.create({
    data: {
      sessionId: mariaSessions[0].id,
      athleteId: athleteOneUser.id,
      isDone: true,
      completedAt: addHours(addDays(weekStart, 0), 9),
      notes: 'Felt smooth. Added 5 min extra easy jogging at the end.',
    },
  });

  await prisma.sessionCompletion.create({
    data: {
      sessionId: andersSessions[0].id,
      athleteId: athleteTwoUser.id,
      isDone: false,
      notes: 'Planned for early morning before work.',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
