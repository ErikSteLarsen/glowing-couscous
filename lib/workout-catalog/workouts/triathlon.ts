import type { CatalogCategory, CatalogItem, CatalogLevel, CatalogSport, CatalogStep, CatalogWorkout } from '../types.ts';

/**
 * Public workouts that the built-in triathlon plans are made of. Plans reference them by
 * slug (`lib/plan-catalog`), so a workout here is the same one in the library and in a plan.
 */

type Effort = [lowPct: number, highPct: number];
const EASY: Effort = [55, 60];
const ENDURANCE: Effort = [62, 70];
const THRESHOLD: Effort = [94, 98];
const VO2: Effort = [112, 118];

function step(kind: CatalogStep['kind'], durationSec: number, [lowPct, highPct]: Effort, cue: string, distanceM?: number): CatalogStep {
  return { kind, durationSec, lowPct, highPct, cue, ...(distanceM ? { distanceM } : {}) };
}

function totalSec(items: CatalogItem[]): number {
  return items.reduce((sum, item) => sum + ('repeat' in item
    ? item.repeat * item.steps.reduce((inner, entry) => inner + entry.durationSec, 0)
    : item.durationSec), 0);
}

type Details = { category: CatalogCategory; level: CatalogLevel; summary: string; description: string[]; tags: string[] };

function define(slug: string, name: string, sport: CatalogSport, details: Details, items: CatalogItem[]): CatalogWorkout {
  return { slug, name, sport, ...details, description: details.description.join('\n\n'), tags: ['triathlon', ...details.tags], items };
}

const voice = {
  BIKING: { noun: 'Ride', easy: 'Spin easily.', warmup: [45, 75] as Effort, cooldown: [40, 55] as Effort },
  RUNNING: { noun: 'Run', easy: 'Jog easily.', warmup: [52, 62] as Effort, cooldown: [52, 62] as Effort },
};

const thresholdNote = 'Threshold here means your second lactate threshold (LT2): the hardest effort you can hold steady while breathing stays under control. Finish the last effort feeling that you could have done one more.';
const vo2Note = 'The short recoveries keep your oxygen uptake high. Start the first set slightly easier than you think you need to, so the last set is as strong as the first.';

type Set = { key: string; category: 'threshold' | 'vo2max'; label: string; level: CatalogLevel; summary: string; items: CatalogItem[] };

function thresholdRepeat(repeat: number, minutes: number, easy: string): CatalogItem {
  return { repeat, steps: [
    step('work', minutes * 60, THRESHOLD, 'Hold a controlled threshold effort.'),
    step('recovery', 120, EASY, `Recover. ${easy}`),
  ] };
}

function shortRepeats(repeat: number, onSec: number, offSec: number, easy: string): CatalogItem[] {
  const set: CatalogItem = { repeat, steps: [
    step('work', onSec, VO2, 'Hard, but repeatable.'),
    step('recovery', offSec, EASY, 'Back off.'),
  ] };
  const rest = step('recovery', 180, EASY, `Recover between sets. ${easy}`);
  return [set, rest, set, rest, set];
}

const runSets: Set[] = [
  { key: '5x8-lt2', category: 'threshold', label: '5 × 8', level: 'intermediate', summary: 'Five 8-minute threshold efforts with 2-minute jog recoveries.', items: [thresholdRepeat(5, 8, voice.RUNNING.easy)] },
  { key: '8x4-lt2', category: 'threshold', label: '8 × 4', level: 'intermediate', summary: 'Eight 4-minute threshold efforts with 2-minute jog recoveries.', items: [thresholdRepeat(8, 4, voice.RUNNING.easy)] },
  { key: '40-20-vo2', category: 'vo2max', label: '40/20', level: 'advanced', summary: 'Three sets of ten 40-second hard efforts with 20 seconds easy between them.', items: shortRepeats(10, 40, 20, voice.RUNNING.easy) },
];

const bikeSets: Set[] = [
  { key: '5x10-lt2', category: 'threshold', label: '5 × 10', level: 'intermediate', summary: 'Five 10-minute threshold efforts with 2-minute recoveries.', items: [thresholdRepeat(5, 10, voice.BIKING.easy)] },
  { key: '6x10-lt2', category: 'threshold', label: '6 × 10', level: 'advanced', summary: 'Six 10-minute threshold efforts with 2-minute recoveries.', items: [thresholdRepeat(6, 10, voice.BIKING.easy)] },
  { key: '8-and-4-lt2', category: 'threshold', label: '4 × 8 + 4 × 4', level: 'advanced', summary: 'Four 8-minute and four 4-minute threshold efforts with 2-minute recoveries.', items: [thresholdRepeat(4, 8, voice.BIKING.easy), thresholdRepeat(4, 4, voice.BIKING.easy)] },
  { key: '45-15-vo2', category: 'vo2max', label: '45/15', level: 'advanced', summary: 'Three sets of twelve 45-second hard efforts with 15 seconds easy between them.', items: shortRepeats(12, 45, 15, voice.BIKING.easy) },
];

function intervals(sport: 'RUNNING' | 'BIKING', minutes: number, extended: boolean, set: Set): CatalogWorkout {
  const { noun, easy, warmup, cooldown } = voice[sport];
  const [warmupSec, fullCooldownSec] = sport === 'RUNNING' ? [900, 600] : [720, 480];
  const spareSec = minutes * 60 - warmupSec - fullCooldownSec - totalSec(set.items);
  // The set already ends with an easy recovery, so a tight session takes it out of the cool-down.
  const cooldownSec = fullCooldownSec + Math.min(0, spareSec);
  const name = `${set.category === 'threshold' ? 'Threshold' : 'VO2 Max'} ${noun} ${set.label}${extended ? ' Extended' : ''}`;
  return define(`${sport === 'RUNNING' ? 'run' : 'bike'}-intervals-${minutes}-${set.key}`, name, sport, {
    category: set.category,
    level: set.level,
    summary: set.summary,
    description: [
      set.category === 'threshold' ? thresholdNote : vo2Note,
      extended ? `This is the longer version: the same intervals inside ${minutes} minutes, with more easy ${sport === 'RUNNING' ? 'running' : 'riding'} after the main set.` : '',
    ].filter(Boolean),
    tags: ['intervals', set.category === 'threshold' ? 'lt2' : 'vo2'],
  }, [
    step('warmup', warmupSec, warmup, `${easy} Build gradually towards the first effort.`),
    ...set.items,
    ...(spareSec > 0 ? [step('recovery', spareSec, EASY, easy)] : []),
    step('cooldown', cooldownSec, cooldown, easy),
  ]);
}

const poolNote = 'Swim times are estimates. Count lengths in the pool, swim each distance at your own pace and take the stated rest.';

function swimSet(minutes: 60 | 90, reps: number, meters: number, restSec: number): CatalogWorkout {
  const extended = minutes === 90;
  const repSec = 3000 / reps;
  return define(`swim-intervals-${minutes}-${reps}x${meters}`, `Swim Set ${reps} × ${meters} m${extended ? ' Extended' : ''}`, 'SWIMMING', {
    category: 'tempo',
    level: meters === 200 ? 'advanced' : 'intermediate',
    summary: `${reps} × ${meters} m with ${restSec} seconds rest between repeats, 2,000 m in total.`,
    description: [
      'Swim every repeat at the same steady, moderately hard pace. Choose a pace you can repeat on the last one without your stroke falling apart.',
      extended ? 'This is the longer version, with extra easy swimming and drills before the main set.' : '',
      poolNote,
    ].filter(Boolean),
    tags: ['intervals', 'pool'],
  }, [
    step('warmup', extended ? 900 : 300, EASY, 'Swim easy and settle into your stroke.'),
    ...(extended ? [step('work', 900, ENDURANCE, 'Familiar drills with easy swimming between them.')] : []),
    { repeat: reps, steps: [
      step('work', repSec - restSec, [80, 84], `Swim ${meters} m at a steady, moderately hard pace.`, meters),
      step('pause', restSec, [30, 30], 'Rest at the wall.'),
    ] },
    step('cooldown', extended ? 600 : 300, EASY, 'Finish with an easy swim.'),
  ]);
}

function steady(slug: string, name: string, sport: CatalogSport, minutes: number, effort: Effort, category: CatalogCategory, level: CatalogLevel, summary: string, description: string[], tags: string[] = []): CatalogWorkout {
  return define(slug, name, sport, { category, level, summary, description, tags: ['steady', ...tags] }, [
    step('work', minutes * 60, effort, summary),
  ]);
}

const bikeWorkouts: CatalogWorkout[] = [
  ...bikeSets.map((set) => intervals('BIKING', 90, false, set)),
  ...bikeSets.map((set) => intervals('BIKING', 120, true, set)),
  steady('recovery-ride', 'Recovery Ride', 'BIKING', 45, EASY, 'recovery', 'beginner', 'A very easy ride to loosen up between harder days.', ['Keep the pressure on the pedals light the whole way. You should be able to chat without pausing for breath.', 'Extend it to 60 minutes if you feel fresh.']),
  steady('easy-ride', 'Easy Ride', 'BIKING', 75, EASY, 'endurance', 'beginner', 'A relaxed ride that adds volume without adding fatigue.', ['Stay relaxed and keep the effort low, even when it feels too easy.', 'Anything from 45 to 90 minutes works.']),
  steady('long-ride', 'Long Ride', 'BIKING', 120, ENDURANCE, 'endurance', 'intermediate', 'Two steady hours at an effort you could hold all day.', ['Settle in and keep the effort even. Eat and drink from the first half hour.', 'Anything from 90 to 150 minutes works.']),
  steady('brick-ride', 'Brick Ride', 'BIKING', 150, ENDURANCE, 'endurance', 'advanced', 'A long steady ride that leads straight into a run.', ['Have your running shoes ready so you can start Brick Run right after you get off the bike.', 'Anything from 90 to 180 minutes works.'], ['brick']),
];

const runWorkouts: CatalogWorkout[] = [
  ...runSets.map((set) => intervals('RUNNING', 75, false, set)),
  ...runSets.map((set) => intervals('RUNNING', 90, true, set)),
  steady('recovery-run', 'Recovery Run', 'RUNNING', 30, EASY, 'recovery', 'beginner', 'A very easy run to loosen up between harder days.', ['Keep it slow enough to chat. Walk breaks are fine.', 'Extend it to 60 minutes if you feel fresh.']),
  steady('easy-run', 'Easy Run', 'RUNNING', 55, EASY, 'endurance', 'beginner', 'A relaxed run that adds volume without adding fatigue.', ['Run by feel and keep the effort low the whole way. Shorten or lengthen it to fit your week.']),
  steady('long-run', 'Long Run', 'RUNNING', 75, ENDURANCE, 'endurance', 'intermediate', 'A steady long run at a comfortable effort.', ['Start slower than you want to and let the pace come to you.', 'Anything from 60 to 90 minutes works.']),
  steady('brick-run', 'Brick Run', 'RUNNING', 25, EASY, 'endurance', 'intermediate', 'A short easy run straight off the bike.', ['Start right after Brick Ride. Your legs will feel heavy for the first few minutes, so keep it easy and let them settle.', 'Anything from 20 to 30 minutes works.'], ['brick']),
];

const swimWorkouts: CatalogWorkout[] = [
  ...([60, 90] as const).flatMap((minutes) => [swimSet(minutes, 10, 200, 35), swimSet(minutes, 20, 100, 20), swimSet(minutes, 40, 50, 15)]),
  define('swim-technique', 'Technique and Distance Swim', 'SWIMMING', {
    category: 'endurance',
    level: 'beginner',
    summary: 'Familiar drills, then steady distance with a relaxed stroke.',
    description: ['Use drills you already know, then carry the same feel into the steady swim.', poolNote],
    tags: ['technique', 'pool'],
  }, [
    step('warmup', 600, EASY, 'Swim easy.'),
    step('work', 1200, ENDURANCE, 'Familiar drills with easy swimming between them.'),
    step('work', 1500, ENDURANCE, 'Swim steadily and carry the drill cues into your stroke.'),
    step('cooldown', 300, EASY, 'Finish with an easy swim.'),
  ]),
  steady('morning-swim', 'Easy Morning Swim', 'SWIMMING', 60, EASY, 'recovery', 'beginner', 'A relaxed swim with breaks whenever you want them.', ['Keep every length easy and rest at the wall as needed.', poolNote], ['pool']),
];

export const triathlonWorkouts: CatalogWorkout[] = [...bikeWorkouts, ...runWorkouts, ...swimWorkouts];
