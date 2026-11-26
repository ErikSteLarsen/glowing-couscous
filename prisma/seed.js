const { PrismaClient } = require('@prisma/client');
const { addDays, addHours, addMinutes, endOfWeek, startOfWeek, subWeeks } = require('date-fns');
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

// ---------------------------------------------------------------------------
// Mara's self-directed endurance history (deterministic, relative to today)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const liveZoneMeta = {
  1: { label: 'Z1 Recovery', solid: '#7F9BB5', tint: '#7F9BB529', factor: 0.55 },
  2: { label: 'Z2 Endurance', solid: '#4FB89F', tint: '#4FB89F29', factor: 0.7 },
  3: { label: 'Z3 Tempo', solid: '#D9B44A', tint: '#D9B44A29', factor: 0.85 },
  4: { label: 'Z4 Threshold', solid: '#EE8A4C', tint: '#EE8A4C29', factor: 0.98 },
  5: { label: 'Z5 VO2 max', solid: '#E8667E', tint: '#E8667E29', factor: 1.1 },
};

// Mirrors lib/session-math.ts deriveSessionMetrics (reps expand into repeated segments).
function deriveMetrics(blocks) {
  const zoneDistributionSec = [0, 0, 0, 0, 0];
  const segments = [];
  let rawTss = 0;
  let durationSec = 0;

  blocks.forEach((block, sourceIndex) => {
    const reps = block.reps ?? 1;
    for (let occurrence = 0; occurrence < reps; occurrence += 1) {
      const meta = liveZoneMeta[block.zone];
      zoneDistributionSec[block.zone - 1] += block.durationSec;
      durationSec += block.durationSec;
      rawTss += (block.durationSec / 3600) * meta.factor * meta.factor * 100;
      segments.push({
        key: reps > 1 ? `${block.kind}-${sourceIndex}-${occurrence}` : `${block.kind}-${sourceIndex}`,
        zone: block.zone,
        durationSec: block.durationSec,
        label: meta.label,
        color: meta.solid,
        tint: meta.tint,
      });
    }
  });

  return { durationSec, tss: Math.round(rawTss), zoneDistributionSec, segments };
}

const roundTo = (value, step) => Math.max(step, Math.round(value / step) * step);

const withReps = (block, reps) => (reps > 1 ? { ...block, reps } : block);

// Reusable workout shapes. `load` is the weekly load multiplier (about 0.6 to 1.3).
const workoutShapes = {
  easy: ({ sport, load }) => {
    const minutes = roundTo((sport === 'BIKING' ? 60 : 45) * load, 5);
    return {
      title: sport === 'BIKING' ? 'Easy aerobic ride' : 'Easy aerobic run',
      summary: 'Conversational effort, stay in Z2.',
      blocks: [
        { kind: 'warmup', zone: 1, durationSec: 300, note: '5 min easy' },
        { kind: 'work', zone: 2, durationSec: (minutes - 5) * 60, note: 'Steady aerobic' },
      ],
    };
  },
  long: ({ sport, load }) => {
    const minutes = roundTo((sport === 'BIKING' ? 150 : 80) * load, 5);
    return {
      title: sport === 'BIKING' ? 'Long endurance ride' : 'Long endurance run',
      summary: 'Long aerobic session, fuel early and keep it steady.',
      blocks: [
        { kind: 'warmup', zone: 1, durationSec: 600, note: '10 min easy' },
        { kind: 'work', zone: 2, durationSec: (minutes - 15) * 60, note: 'Steady endurance' },
        { kind: 'cooldown', zone: 1, durationSec: 300, note: '5 min easy' },
      ],
    };
  },
  tempo: ({ load }) => {
    const workSec = Math.max(600, roundTo(900 * load, 300));
    return {
      title: `Tempo 2×${workSec / 60}′`,
      summary: 'Comfortably hard tempo blocks.',
      blocks: [
        { kind: 'warmup', zone: 1, durationSec: 900, note: '15 min easy' },
        { kind: 'work', zone: 3, durationSec: workSec, reps: 2, note: 'Tempo blocks' },
        { kind: 'recovery', zone: 2, durationSec: 300, note: '5 min easy between' },
        { kind: 'cooldown', zone: 1, durationSec: 600, note: '10 min easy' },
      ],
    };
  },
  threshold: ({ load }) => {
    const reps = load < 0.7 ? 3 : load < 1 ? 4 : 5;
    return {
      title: `Threshold ${reps}×8′`,
      summary: 'Even threshold reps with short recoveries.',
      blocks: [
        { kind: 'warmup', zone: 1, durationSec: 900, note: '15 min easy + strides' },
        withReps({ kind: 'work', zone: 4, durationSec: 480, note: 'Threshold reps' }, reps),
        withReps({ kind: 'recovery', zone: 2, durationSec: 120, note: '2 min easy' }, reps - 1),
        { kind: 'cooldown', zone: 1, durationSec: 600, note: '10 min easy' },
      ],
    };
  },
  vo2: ({ load }) => {
    const reps = load < 0.7 ? 4 : load < 1 ? 5 : 6;
    return {
      title: `VO2 ${reps}×3′`,
      summary: 'Short, sharp intervals with full recovery.',
      blocks: [
        { kind: 'warmup', zone: 1, durationSec: 900, note: '15 min easy + strides' },
        withReps({ kind: 'work', zone: 5, durationSec: 180, note: 'Hard, controlled' }, reps),
        withReps({ kind: 'recovery', zone: 1, durationSec: 150, note: 'Easy jog or spin' }, reps - 1),
        { kind: 'cooldown', zone: 1, durationSec: 600, note: '10 min easy' },
      ],
    };
  },
  recovery: ({ sport }) => ({
    title: sport === 'BIKING' ? 'Recovery spin' : 'Recovery run',
    summary: 'Very easy, flush the legs.',
    blocks: [{ kind: 'work', zone: 1, durationSec: 2100, note: 'Very easy' }],
  }),
  swim: ({ load }) => ({
    title: 'Aerobic swim',
    summary: 'Technique focus, relaxed aerobic swimming.',
    blocks: [
      { kind: 'warmup', zone: 1, durationSec: 300, note: '200 m easy + drills' },
      { kind: 'work', zone: 2, durationSec: roundTo(1800 * load, 300), note: 'Steady aerobic' },
      { kind: 'cooldown', zone: 1, durationSec: 300, note: '200 m easy' },
    ],
  }),
};

const weekLoadCycle = [0.85, 0.95, 1.05, 0.6];
const qualityRotation = ['threshold', 'vo2', 'tempo'];

// Slots for a week index (0 = oldest history week). Count: 4 recovery, 6 peak, otherwise 5.
function weekSlots(k) {
  const cycle = k % 4;
  const isRecovery = cycle === 3;
  const quality = isRecovery ? 'easy' : qualityRotation[k % 3];
  const slots = [
    { day: 1, sport: 'RUNNING', shape: quality, time: '06:30', hour: 6.5 },
    { day: 2, sport: 'BIKING', shape: k % 2 === 0 || isRecovery ? 'easy' : 'tempo', time: '17:30', hour: 17.5 },
  ];
  if (!isRecovery) {
    slots.push(
      k % 2 === 0
        ? { day: 3, sport: 'SWIMMING', shape: 'swim', time: '06:15', hour: 6.25 }
        : { day: 3, sport: 'RUNNING', shape: 'easy', time: '06:30', hour: 6.5 },
    );
  }
  if (cycle === 2) slots.push({ day: 4, sport: 'RUNNING', shape: 'recovery', time: '07:00', hour: 7 });
  slots.push(
    { day: 5, sport: 'BIKING', shape: 'long', time: '08:30', hour: 8.5 },
    { day: 6, sport: 'RUNNING', shape: 'long', time: '09:00', hour: 9 },
  );
  return slots;
}

function snapshotJson({ sport, title, summary, date, timeLabel, athleteId, notes, rpe, status, blocks }) {
  return JSON.stringify({
    snapshotVersion: 1,
    id: null,
    athleteId,
    coachOwnerId: null,
    trainingPlanId: null,
    planId: null,
    templateId: null,
    assignedById: null,
    scheduledDate: date.toISOString(),
    planWeekday: null,
    timeLabel,
    sport,
    title,
    summary,
    coachNotes: null,
    athleteNotes: notes,
    rpe,
    sportMetrics: {},
    status,
    source: 'athlete',
    adjusted: false,
    blocks: blocks.map((block, sortOrder) => ({
      id: null,
      kind: block.kind,
      zone: block.zone,
      durationSec: block.durationSec,
      reps: block.reps ?? null,
      targetType: null,
      targetMode: 'absolute',
      targetReference: null,
      targetLow: null,
      targetHigh: null,
      targetLowDecimal: null,
      targetHighDecimal: null,
      note: block.note ?? null,
      skipped: false,
      sortOrder,
    })),
  });
}

const notePool = {
  easy: ['Easy and smooth.', 'Legs a bit heavy early, fine after 15 min.', 'Felt good.', 'Windy.'],
  hard: ['Solid.', 'Last rep tough.', 'Strong on the first half.', 'Heart rate drifted late.', 'Legs flat today.'],
  long: ['Fuelled well.', 'Tired last 20 min.', 'Great weather.', 'Steady all the way.'],
  short: ['Cut short, tired.', 'Cut short, work ran late.', 'Felt off, stopped early.'],
};

function rpeFor(blocks, ratio, rand) {
  const maxZone = Math.max(...blocks.map((block) => block.zone));
  const base = { 1: 2, 2: 3.5, 3: 5.5, 4: 7.5, 5: 8.5 }[maxZone];
  const longBonus = maxZone === 2 && blocks.reduce((sum, b) => sum + b.durationSec * (b.reps ?? 1), 0) >= 7200 ? 1 : 0;
  const value = base + longBonus + (ratio - 1) * 2 + (rand() - 0.5) * 1.4;
  return Math.max(2, Math.min(9, Math.round(value)));
}

function buildSessionPlan(k, slot, weekStartDate) {
  const load = weekLoadCycle[k % 4] * (1 + 0.04 * Math.floor(k / 4));
  const shape = workoutShapes[slot.shape]({ sport: slot.sport, load });
  const date = addMinutes(addDays(weekStartDate, slot.day), Math.round(slot.hour * 60));
  return { ...shape, sport: slot.sport, date, timeLabel: slot.time, shapeKey: slot.shape };
}

// Long enough for 42-day fitness to settle before the 12 weeks the dashboard shows.
const HISTORY_WEEKS = 24;

async function seedMaraTrainingHistory(mara) {
  const rand = mulberry32(20240607);
  const forcedPlanned = new Set([`${HISTORY_WEEKS - 2}:2`, `${HISTORY_WEEKS - 4}:1`]); // "weekIndex:slotIndex" planned-but-past, no activity
  let missedCount = 0;

  for (let weekOffset = -HISTORY_WEEKS; weekOffset <= 2; weekOffset += 1) {
    if (weekOffset === 0) continue; // current week is seeded above
    const k = weekOffset + HISTORY_WEEKS;
    const weekStartDate = addDays(weekStart, weekOffset * 7);
    const slots = weekSlots(k);

    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const plan = buildSessionPlan(k, slots[slotIndex], weekStartDate);
      const common = {
        athleteId: mara.id,
        date: plan.date,
        timeLabel: plan.timeLabel,
        sport: plan.sport,
        title: plan.title,
        summary: plan.summary,
        source: 'athlete',
      };
      const blockCreate = (blocks) => ({
        create: blocks.map((block, sortOrder) => ({ ...block, sortOrder })),
      });

      if (weekOffset > 0) {
        await prisma.session.create({ data: { ...common, status: 'planned', blocks: blockCreate(plan.blocks) } });
        continue;
      }

      const roll = rand();
      const forcedKey = `${k}:${slotIndex}`;
      if (forcedPlanned.has(forcedKey)) {
        await prisma.session.create({ data: { ...common, status: 'planned', blocks: blockCreate(plan.blocks) } });
        continue;
      }
      if (roll < 0.1) {
        missedCount += 1;
        await prisma.session.create({ data: { ...common, status: 'missed', blocks: blockCreate(plan.blocks) } });
        continue;
      }

      // Completed: scale the planned blocks to an actual outcome.
      const planned = deriveMetrics(plan.blocks);
      const isShort = rand() < 0.1;
      const ratio = isShort ? 0.48 + rand() * 0.1 : 0.7 + ((rand() + rand()) / 2) * 0.45;
      const actualBlocks = plan.blocks.map((block) => ({
        ...block,
        durationSec: Math.max(60, Math.round((block.durationSec * ratio) / 60) * 60),
      }));
      const actual = deriveMetrics(actualBlocks);
      const rpe = rpeFor(plan.blocks, ratio, rand);
      const compliancePct = Math.round((actual.durationSec / planned.durationSec) * 100);
      const hard = plan.blocks.some((block) => block.zone >= 3);
      const pool = isShort ? notePool.short : plan.shapeKey === 'long' ? notePool.long : hard ? notePool.hard : notePool.easy;
      const notes = isShort || rand() < 0.3 ? pool[Math.floor(rand() * pool.length)] : null;

      const snapshotBase = { ...common, athleteId: mara.id, summary: plan.summary };
      await prisma.session.create({
        data: {
          ...common,
          athleteNotes: notes,
          rpe,
          status: 'completed',
          coachBaselineJson: snapshotJson({ ...snapshotBase, notes: null, rpe: null, status: 'planned', blocks: plan.blocks }),
          blocks: blockCreate(actualBlocks),
          activity: {
            create: {
              athleteId: mara.id,
              completedAt: plan.date,
              durationSec: actual.durationSec,
              tss: actual.tss,
              compliancePct,
              zoneDistributionJson: JSON.stringify(actual.zoneDistributionSec),
              segmentsJson: JSON.stringify(actual.segments),
              metricsSource: 'manual-actual',
              notes,
              rpe,
              actualSnapshotJson: snapshotJson({ ...snapshotBase, notes, rpe, status: 'completed', blocks: actualBlocks }),
            },
          },
        },
      });
    }
  }

  // Reusable library: standalone workouts (no date, no plan, owned by the athlete).
  const library = [
    { sport: 'RUNNING', shape: 'easy' },
    { sport: 'BIKING', shape: 'long' },
    { sport: 'RUNNING', shape: 'tempo' },
    { sport: 'RUNNING', shape: 'threshold' },
    { sport: 'RUNNING', shape: 'vo2' },
    { sport: 'BIKING', shape: 'recovery' },
  ];
  for (const entry of library) {
    const shape = workoutShapes[entry.shape]({ sport: entry.sport, load: 1 });
    await prisma.session.create({
      data: {
        athleteId: mara.id,
        sport: entry.sport,
        title: shape.title,
        summary: shape.summary,
        status: 'planned',
        source: 'athlete',
        blocks: { create: shape.blocks.map((block, sortOrder) => ({ ...block, sortOrder })) },
      },
    });
  }

  return missedCount;
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
      performanceProfileJson: JSON.stringify({ heartRateMaxBpm: 190 }),
      role: 'ATHLETE',
      selfCoached: false,
      coachId: coachErik.id,
      passwordHash,
      prefsJson: overviewCards('coachNote', 'lastActivity', 'weekLoad', 'trend'),
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

  const thresholdWorkout = await createSessionWithBlocks({
    athleteId: sofie.id,
    date: null,
    source: 'athlete-library',
    title: 'Threshold 4×8′',
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

  const enduranceWorkout = await createSessionWithBlocks({
    athleteId: sofie.id,
    date: null,
    source: 'athlete-library',
    title: 'Endurance 90′',
    sport: 'BIKING',
    summary: 'Long aerobic endurance session.',
    blocks: [
      { kind: 'warmup', zone: 1, durationSec: 600, note: '10 min easy spin' },
      { kind: 'work', zone: 2, durationSec: 4200, targetType: 'hr', targetMode: 'relative', targetReference: 'max-hr', targetLow: 72, targetHigh: 82, note: 'Steady endurance riding' },
      { kind: 'cooldown', zone: 1, durationSec: 600, note: '10 min easy spin down' },
    ],
  });

  await prisma.template.create({ data: {
    ownerId: sofie.id, name: 'Endurance and intervals', summary: 'A weekly routine made from saved workouts.',
    routineJson: JSON.stringify({ version: 1, entries: [0, 1, 2, 3, 4].map(weekday => {
      const workout = weekday % 2 === 0 ? enduranceWorkout : thresholdWorkout;
      return { weekday, workoutId: workout.id, title: workout.title, sport: workout.sport,
        summary: workout.summary, sportMetricsJson: workout.sportMetricsJson,
        blocks: workout.blocks.map(({ id, sessionId, ...block }) => block) };
    }) }),
  } });

  const maraThresholdBlocks = thresholdWorkout.blocks.map(({ kind, zone, durationSec, reps, targetType, targetMode, targetReference, targetLow, targetHigh, note }) => ({
    kind,
    zone,
    durationSec,
    reps,
    targetType,
    targetMode,
    targetReference,
    targetLow,
    targetHigh,
    note,
  }));

  const maraToday = await createSessionWithBlocks({
    athleteId: mara.id,
    planId: maraPlan.id,
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
    assignedById: coachErik.id,
    date: addHours(addDays(weekStart, 0), 17),
    timeLabel: '17:00',
    sport: 'BIKING',
    title: 'Easy spin',
    summary: 'Flush the legs after the morning quality session.',
    source: 'coach',
    blocks: [
      { kind: 'work', zone: 2, durationSec: 2700, targetType: 'hr', targetMode: 'relative', targetReference: 'max-hr', targetLow: 72, targetHigh: 82, note: 'Continuous easy spinning' },
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
      { kind: 'work', zone: 5, durationSec: 180, reps: 6, targetType: 'hr', targetMode: 'relative', targetReference: 'max-hr', targetLow: 92, targetHigh: 100, note: '6 x 3 min hard' },
      { kind: 'recovery', zone: 2, durationSec: 120, reps: 5, note: '2 min easy between reps' },
      { kind: 'cooldown', zone: 1, durationSec: 600, note: '10 min cool-down' },
    ],
  });

  const jonasSession = await createSessionWithBlocks({
    athleteId: jonas.id,
    planId: jonasPlan.id,
    assignedById: coachErik.id,
    date: addHours(addDays(weekStart, 1), 7),
    timeLabel: '07:00',
    sport: 'BIKING',
    title: 'Endurance 90′',
    summary: 'Comfortable aerobic work with smooth cadence.',
    source: 'coach',
    blocks: enduranceWorkout.blocks.map(({ kind, zone, durationSec, reps, targetType, targetMode, targetReference, targetLow, targetHigh, note }) => ({
      kind,
      zone,
      durationSec,
      reps,
      targetType,
      targetMode,
      targetReference,
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
          enduranceWorkout.blocks.map((block) => ({
            zone: block.zone,
            durationSec: block.durationSec,
          })),
        ),
        segmentsJson: JSON.stringify(activitySegments(enduranceWorkout.blocks)),
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

  await seedMaraTrainingHistory(mara);
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
