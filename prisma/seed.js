const { PrismaClient } = require('@prisma/client');
const { addDays, addHours, endOfWeek, startOfWeek, subWeeks } = require('date-fns');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

function overviewCards(...cards) {
  return JSON.stringify({ overviewCards: cards });
}

function zoneDistribution(blocks) {
  const totals = [0, 0, 0, 0, 0];

  for (const block of blocks) {
    totals[block.zone - 1] += block.durationSec;
  }

  return JSON.stringify(totals);
}

const zoneMeta = {
  1: { label: 'Z1', name: 'Recovery', solid: '#3B82F6', tint: '#E8F0FE' },
  2: { label: 'Z2', name: 'Endurance', solid: '#22C55E', tint: '#E3F7EC' },
  3: { label: 'Z3', name: 'Tempo', solid: '#EAB308', tint: '#FBF1D5' },
  4: { label: 'Z4', name: 'Threshold', solid: '#F97316', tint: '#FEEDE0' },
  5: { label: 'Z5', name: 'VO2 max', solid: '#EF4444', tint: '#FCE8E7' },
};

function activitySegments(blocks) {
  return blocks.map((block, index) => {
    const meta = zoneMeta[block.zone] ?? zoneMeta[1];
    return {
      key: `${block.kind}-${index}`,
      zone: block.zone,
      durationSec: block.durationSec,
      label: `${meta.label} ${meta.name}`,
      color: meta.solid,
      tint: meta.tint,
    };
  });
}

async function createTemplateWithBlocks(data) {
  return prisma.template.create({
    data: {
      ownerId: data.ownerId,
      name: data.name,
      sport: data.sport,
      summary: data.summary,
      blocks: {
        create: data.blocks.map((block, index) => ({
          ...block,
          sortOrder: index,
        })),
      },
    },
    include: {
      blocks: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

async function createSessionWithBlocks(data) {
  return prisma.session.create({
    data: {
      athleteId: data.athleteId,
      planId: data.planId ?? null,
      templateId: data.templateId ?? null,
      assignedById: data.assignedById ?? null,
      date: data.date,
      timeLabel: data.timeLabel ?? null,
      sport: data.sport,
      title: data.title,
      summary: data.summary ?? null,
      status: data.status ?? 'planned',
      source: data.source,
      adjusted: data.adjusted ?? false,
      blocks: {
        create: data.blocks.map((block, index) => ({
          ...block,
          sortOrder: index,
        })),
      },
    },
    include: {
      blocks: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash('demo1234', 12);

  await prisma.assignment.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.block.deleteMany();
  await prisma.session.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.template.deleteMany();
  await prisma.coachRequest.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const coachErik = await prisma.user.create({
    data: {
      email: 'coach@demo.local',
      name: 'Erik Krogh',
      role: 'COACH',
      selfCoached: false,
      passwordHash,
      prefsJson: overviewCards(),
    },
  });

  const coachNora = await prisma.user.create({
    data: {
      email: 'nora@demo.local',
      name: 'Nora Skaret',
      role: 'COACH',
      selfCoached: false,
      passwordHash,
      prefsJson: overviewCards(),
    },
  });

  const mara = await prisma.user.create({
    data: {
      email: 'mara@demo.local',
      name: 'Mara Holt',
      role: 'ATHLETE',
      selfCoached: false,
      coachId: coachErik.id,
      passwordHash,
      prefsJson: overviewCards('coachNote', 'lastActivity', 'weekLoad'),
    },
  });

  const jonas = await prisma.user.create({
    data: {
      email: 'jonas@demo.local',
      name: 'Jonas Berg',
      role: 'ATHLETE',
      selfCoached: false,
      coachId: coachErik.id,
      passwordHash,
      prefsJson: overviewCards('coachNote', 'weekLoad'),
    },
  });

  const sofie = await prisma.user.create({
    data: {
      email: 'sofie@demo.local',
      name: 'Sofie Lind',
      role: 'ATHLETE',
      selfCoached: true,
      passwordHash,
      prefsJson: overviewCards('lastActivity', 'weekLoad', 'trend'),
    },
  });

  await prisma.coachRequest.create({
    data: {
      athleteId: sofie.id,
      coachId: coachNora.id,
      pendingAthleteId: sofie.id,
      status: 'PENDING',
    },
  });

  const [maraPlan, jonasPlan, sofiePlan] = await Promise.all([
    prisma.plan.create({
      data: {
        athleteId: mara.id,
        name: 'Oslo Marathon Build',
        startDate: subWeeks(weekStart, 2),
        endDate: addDays(endOfWeek(weekStart, { weekStartsOn: 1 }), 70),
        goalRace: 'Oslo Marathon',
      },
    }),
    prisma.plan.create({
      data: {
        athleteId: jonas.id,
        name: '70.3 Progression',
        startDate: subWeeks(weekStart, 1),
        endDate: addDays(endOfWeek(weekStart, { weekStartsOn: 1 }), 84),
        goalRace: 'Haugesund 70.3',
      },
    }),
    prisma.plan.create({
      data: {
        athleteId: sofie.id,
        name: 'Self-Coached 10K',
        startDate: subWeeks(weekStart, 1),
        endDate: addDays(endOfWeek(weekStart, { weekStartsOn: 1 }), 56),
        goalRace: 'Autumn 10K',
      },
    }),
  ]);

  const thresholdTemplate = await createTemplateWithBlocks({
    ownerId: coachErik.id,
    name: 'Threshold 4×8′',
    sport: 'RUNNING',
    summary: 'Controlled threshold intervals with easy recovery.',
    blocks: [
      { kind: 'warmup', zone: 1, durationSec: 720, note: '12 min easy + strides' },
      { kind: 'recovery', zone: 2, durationSec: 480, note: 'Settle into rhythm' },
      { kind: 'work', zone: 4, durationSec: 480, reps: 4, targetType: 'power', targetLow: 250, targetHigh: 265, note: 'Threshold reps' },
      { kind: 'recovery', zone: 2, durationSec: 120, reps: 3, note: '2 min jog between reps' },
      { kind: 'cooldown', zone: 1, durationSec: 600, note: '10 min easy' },
    ],
  });

  const enduranceTemplate = await createTemplateWithBlocks({
    ownerId: coachErik.id,
    name: 'Endurance 90′',
    sport: 'BIKING',
    summary: 'Long aerobic endurance session.',
    blocks: [
      { kind: 'warmup', zone: 1, durationSec: 600, note: '10 min easy spin' },
      { kind: 'work', zone: 2, durationSec: 4200, targetType: 'hr', targetLow: 135, targetHigh: 148, note: 'Steady endurance riding' },
      { kind: 'cooldown', zone: 1, durationSec: 600, note: '10 min easy spin down' },
    ],
  });

  const maraThresholdBlocks = thresholdTemplate.blocks.map(({ kind, zone, durationSec, reps, targetType, targetLow, targetHigh, note }) => ({
    kind,
    zone,
    durationSec,
    reps,
    targetType,
    targetLow,
    targetHigh,
    note,
  }));

  const maraToday = await createSessionWithBlocks({
    athleteId: mara.id,
    planId: maraPlan.id,
    templateId: thresholdTemplate.id,
    assignedById: coachErik.id,
    date: addHours(addDays(weekStart, 0), 6),
    timeLabel: '06:30',
    sport: 'RUNNING',
    title: 'Threshold 4×8′',
    summary: 'Keep the threshold reps controlled and negative-split the last two.',
    source: 'coach',
    blocks: maraThresholdBlocks,
  });

  const maraEvening = await createSessionWithBlocks({
    athleteId: mara.id,
    planId: maraPlan.id,
    templateId: enduranceTemplate.id,
    assignedById: coachErik.id,
    date: addHours(addDays(weekStart, 0), 17),
    timeLabel: '17:00',
    sport: 'BIKING',
    title: 'Easy spin',
    summary: 'Flush the legs after the morning quality session.',
    source: 'coach',
    blocks: [
      { kind: 'work', zone: 2, durationSec: 2700, targetType: 'hr', targetLow: 120, targetHigh: 138, note: 'Continuous easy spinning' },
    ],
  });

  const maraNext = await createSessionWithBlocks({
    athleteId: mara.id,
    planId: maraPlan.id,
    assignedById: coachErik.id,
    date: addHours(addDays(weekStart, 3), 7),
    timeLabel: '07:00',
    sport: 'RUNNING',
    title: 'VO2 6×3′',
    summary: 'Short and sharp, stay relaxed between reps.',
    source: 'coach',
    blocks: [
      { kind: 'warmup', zone: 1, durationSec: 900, note: '15 min easy' },
      { kind: 'work', zone: 5, durationSec: 180, reps: 6, targetType: 'hr', targetLow: 170, targetHigh: 178, note: '6 x 3 min hard' },
      { kind: 'recovery', zone: 2, durationSec: 120, reps: 5, note: '2 min easy between reps' },
      { kind: 'cooldown', zone: 1, durationSec: 600, note: '10 min cool-down' },
    ],
  });

  const jonasSession = await createSessionWithBlocks({
    athleteId: jonas.id,
    planId: jonasPlan.id,
    templateId: enduranceTemplate.id,
    assignedById: coachErik.id,
    date: addHours(addDays(weekStart, 1), 7),
    timeLabel: '07:00',
    sport: 'BIKING',
    title: 'Endurance 90′',
    summary: 'Comfortable aerobic work with smooth cadence.',
    source: 'coach',
    blocks: enduranceTemplate.blocks.map(({ kind, zone, durationSec, reps, targetType, targetLow, targetHigh, note }) => ({
      kind,
      zone,
      durationSec,
      reps,
      targetType,
      targetLow,
      targetHigh,
      note,
    })),
  });

  const sofieSession = await createSessionWithBlocks({
    athleteId: sofie.id,
    planId: sofiePlan.id,
    date: addHours(addDays(weekStart, 2), 18),
    timeLabel: '18:00',
    sport: 'RUNNING',
    title: 'Tempo 2×20′',
    summary: 'Self-coached tempo session with smooth pacing.',
    source: 'self',
    adjusted: true,
    blocks: [
      { kind: 'warmup', zone: 1, durationSec: 900, note: '15 min warm-up' },
      { kind: 'work', zone: 3, durationSec: 1200, reps: 2, targetType: 'pace', targetLow: 255, targetHigh: 265, note: '2 x 20 min tempo' },
      { kind: 'recovery', zone: 2, durationSec: 300, note: '5 min float between reps' },
      { kind: 'cooldown', zone: 1, durationSec: 600, note: '10 min easy' },
    ],
  });

  await prisma.assignment.createMany({
    data: [
      { sessionId: maraToday.id, athleteId: mara.id, assignedBy: coachErik.id },
      { sessionId: maraEvening.id, athleteId: mara.id, assignedBy: coachErik.id },
      { sessionId: maraNext.id, athleteId: mara.id, assignedBy: coachErik.id },
      { sessionId: jonasSession.id, athleteId: jonas.id, assignedBy: coachErik.id },
    ],
  });

  await prisma.activity.createMany({
    data: [
      {
        sessionId: maraToday.id,
        athleteId: mara.id,
        completedAt: addHours(addDays(weekStart, 0), 8),
        durationSec: 4080,
        tss: 78,
        compliancePct: 96,
        zoneDistributionJson: zoneDistribution(maraThresholdBlocks),
        segmentsJson: JSON.stringify(activitySegments(maraThresholdBlocks)),
        metricsSource: 'recorded',
        notes: 'Felt controlled. Held back slightly on rep one and finished strong.',
      },
      {
        sessionId: jonasSession.id,
        athleteId: jonas.id,
        completedAt: addHours(addDays(weekStart, 1), 9),
        durationSec: 5400,
        tss: 72,
        compliancePct: 100,
        zoneDistributionJson: zoneDistribution(
          enduranceTemplate.blocks.map((block) => ({
            zone: block.zone,
            durationSec: block.durationSec,
          })),
        ),
        segmentsJson: JSON.stringify(activitySegments(enduranceTemplate.blocks)),
        metricsSource: 'recorded',
        notes: 'Smooth ride, HR stayed where planned.',
      },
      {
        sessionId: sofieSession.id,
        athleteId: sofie.id,
        completedAt: addHours(addDays(weekStart, 2), 20),
        durationSec: 4200,
        tss: 84,
        compliancePct: 92,
        zoneDistributionJson: zoneDistribution([
          { zone: 1, durationSec: 900 },
          { zone: 3, durationSec: 2400 },
          { zone: 2, durationSec: 300 },
          { zone: 1, durationSec: 600 },
        ]),
        segmentsJson: JSON.stringify(activitySegments([
          { kind: 'warmup', zone: 1, durationSec: 900 },
          { kind: 'work', zone: 3, durationSec: 2400 },
          { kind: 'recovery', zone: 2, durationSec: 300 },
          { kind: 'cooldown', zone: 1, durationSec: 600 },
        ])),
        metricsSource: 'recorded',
        notes: 'Shortened the cooldown slightly to get home before dark.',
      },
    ],
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
