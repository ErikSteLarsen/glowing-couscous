import type { CatalogItem, CatalogRepeat, CatalogStep, CatalogWorkout } from '../types.ts';

function step(
  kind: CatalogStep['kind'],
  durationSec: number,
  lowPct: number,
  highPct: number,
  cadence: CatalogStep['cadence'],
  cue: string,
): CatalogStep {
  return { kind, durationSec, lowPct, highPct, cadence, cue };
}

function repeat(count: number, ...steps: CatalogStep[]): CatalogRepeat {
  return { repeat: count, steps };
}

function easy(seconds: number, pct = 50): CatalogStep {
  return step('recovery', seconds, pct, pct, [80, 95], 'Pedal lightly and let your breathing settle.');
}

function aerobic(seconds: number, pct: number, cue = 'Stay seated and keep the pressure even.'): CatalogStep {
  return step('work', seconds, pct, pct, [95, 105], cue);
}

function attack(seconds: number, pct: number, cue = 'Build power smoothly and hold it through the end.'): CatalogStep {
  return step('work', seconds, pct, pct, [95, 110], cue);
}

function sprint(seconds: number, low: number, high: number, standing = false): CatalogStep {
  return standing
    ? step('work', seconds, low, high, [85, 105], 'Rise smoothly from a rolling start and keep the bike steady.')
    : step('work', seconds, low, high, [100, 120], 'Stay seated and accelerate with quiet hips.');
}

function cruise(minutes: number, pct: number): CatalogStep {
  return step('work', minutes * 60, pct, pct, [85, 95], 'Settle into a smooth rhythm and hold the target.');
}

function warmup(rampMinutes: number, openers: number): CatalogItem[] {
  return [
    step('warmup', rampMinutes * 60, 45, 75, [80, 95], 'Build pressure gradually as your legs loosen up.'),
    repeat(
      openers,
      step('work', 20, 100, 100, [95, 105], 'Spin up smoothly for the opener.'),
      easy(100),
    ),
  ];
}

function cooldown(minutes: number): CatalogStep {
  return step('cooldown', minutes * 60, 40, 55, [75, 90], 'Ease the pressure down and keep turning the pedals.');
}

function intervals(count: number, work: CatalogStep, restSeconds: number, restPct = 50): CatalogRepeat {
  return repeat(count, work, easy(restSeconds, restPct));
}

function cycling(
  workout: Omit<CatalogWorkout, 'sport'>,
  rampMinutes = 9,
  openers = 2,
  cooldownMinutes = 5,
): CatalogWorkout {
  return {
    ...workout,
    sport: 'BIKING',
    items: [...warmup(rampMinutes, openers), ...workout.items, cooldown(cooldownMinutes)],
  };
}

export const intensityWorkouts: CatalogWorkout[] = [
  cycling({
    slug: 'bellows-primer',
    name: 'Bellows Primer',
    category: 'vo2max',
    level: 'beginner',
    summary: 'Six gentle-entry 30/30s introduce the rhythm of high-aerobic work.',
    description: 'Alternate short efforts above FTP with easy spinning to practice changing pace while breathing rises across the set. The short work bouts keep the first exposure manageable.\n\nStay seated around 95–105 rpm and make the first rep feel like the last. Use resistance mode if ERG takes several seconds to settle. Try this early in a build after getting comfortable with steady indoor rides, and stop at four reps if cadence starts to sag.',
    tags: ['indoor', 'short', 'build', 'time-crunched', 'microbursts'],
    items: [intervals(6, aerobic(30, 115), 30)],
  }, 8, 1, 4),
  cycling({
    slug: 'crosswind-bellows',
    name: 'Crosswind Bellows',
    category: 'vo2max',
    level: 'intermediate',
    summary: 'Two blocks of 30/30s build a repeatable high-aerobic rhythm.',
    description: 'Short recoveries let breathing stay elevated across each block. The second block raises power slightly while keeping the same timing.\n\nKeep the transitions smooth at roughly 100 rpm. Resistance mode helps if ERG lags on the switches. Use during a build week, and keep the second block at the first block’s power if the last few reps are a struggle.',
    tags: ['indoor', 'build', 'microbursts'],
    items: [intervals(7, aerobic(30, 118), 30), easy(240), intervals(9, aerobic(30, 121), 30)],
  }),
  cycling({
    slug: 'narrow-hinge',
    name: 'Narrow Hinge',
    category: 'vo2max',
    level: 'intermediate',
    summary: 'Two blocks of 40/20s test your ability to hold power on short recoveries.',
    description: 'Forty seconds of work and twenty seconds easy keep aerobic demand elevated once the block gets going. Start with enough restraint to keep the last rep even.\n\nUse 95–105 rpm and switch to resistance mode if the trainer lags. Schedule this after you can finish 30/30s evenly. Drop two reps from each block if the short recoveries catch up with you.',
    tags: ['indoor', 'build', 'microbursts', 'erg-off'],
    items: [intervals(8, aerobic(40, 113), 20, 55), easy(300), intervals(9, aerobic(40, 115), 20, 55)],
  }),
  cycling({
    slug: 'close-grain',
    name: 'Close Grain',
    category: 'vo2max',
    level: 'advanced',
    summary: 'Three blocks of 30/15 microbursts keep the relief brief and the aerobic load high.',
    description: 'The fifteen-second floats give just enough room to reset the pedal stroke while breathing stays high. The middle block is the longest, so save something for its last few changes.\n\nRide near 100 rpm and use resistance mode for quick changes. Put this in a high-aerobic build after mastering longer floats. For a lighter day, ride the first two blocks and cool down.',
    tags: ['indoor', 'build', 'microbursts', 'erg-off'],
    items: [
      intervals(9, aerobic(30, 119), 15, 55),
      easy(240),
      intervals(11, aerobic(30, 119), 15, 55),
      easy(240),
      intervals(8, aerobic(30, 121), 15, 55),
    ],
  }),
  cycling({
    slug: 'three-minute-switchbacks',
    name: 'Three-Minute Switchbacks',
    category: 'vo2max',
    level: 'intermediate',
    summary: 'Four three-minute climbs develop even pacing above threshold.',
    description: 'Sustained three-minute efforts give oxygen uptake time to rise within each rep. An easy spin between climbs lets you return to the same power.\n\nStay seated with a light grip and aim around 95 rpm. ERG can steady the long efforts if you establish cadence before each step. Use in early build and ride three reps if the fourth would cost you your form.',
    tags: ['indoor', 'build', 'climbing'],
    items: [intervals(4, aerobic(180, 113), 150)],
  }),
  cycling({
    slug: 'four-minute-ridge',
    name: 'Four-Minute Ridge',
    category: 'vo2max',
    level: 'intermediate',
    summary: 'Four four-minute efforts build sustained high-aerobic power.',
    description: 'The four-minute reps are long enough for breathing to climb without needing a sprint off the line. Aim for even power from the first minute through the fourth.\n\nSpin near 95–100 rpm and use ERG if it helps you keep an even load. Place this after shorter VO2 work in a build. Trim the final rep if your cadence declines despite the easy recovery.',
    tags: ['indoor', 'build', 'climbing'],
    items: [intervals(4, aerobic(240, 111), 210)],
  }),
  cycling({
    slug: 'long-roof',
    name: 'Long Roof',
    category: 'vo2max',
    level: 'advanced',
    summary: 'Five five-minute efforts extend time spent at a demanding aerobic output.',
    description: 'Five-minute reps create sustained oxygen demand, with easy pedaling between efforts to restore repeatability. Use the opening rep to judge how the later ones will feel.\n\nRide seated around 95 rpm and choose ERG only if cadence stays steady under load. Put this in late build. Start with four reps or lower the target a few points if the last minute of each effort becomes a grind.',
    tags: ['indoor', 'build', 'long'],
    items: [intervals(5, aerobic(300, 108), 240)],
  }),
  cycling({
    slug: 'twin-minute-gantries',
    name: 'Twin-Minute Gantries',
    category: 'vo2max',
    level: 'advanced',
    summary: 'Eight two-minute efforts accumulate high-aerobic work in two groups.',
    description: 'The short recoveries within each group keep oxygen demand elevated across successive efforts. Extra time between groups makes the second four repeatable.\n\nSettle at 95–105 rpm and keep the first ten seconds controlled. ERG is fine if it reaches the target promptly. Use in build or race preparation and ride three efforts in the second group if power drops.',
    tags: ['indoor', 'build', 'race-prep'],
    items: [intervals(4, aerobic(120, 118), 90), easy(210), intervals(4, aerobic(120, 120), 90)],
  }),
  cycling({
    slug: 'falling-ridgeline',
    name: 'Falling Ridgeline',
    category: 'vo2max',
    level: 'advanced',
    summary: 'Two descending pyramids trade interval length for power as each set unfolds.',
    description: 'Start with four minutes to raise oxygen demand, then ride three, two and one minute at progressively higher power. The second descent repeats the pacing challenge on tired legs.\n\nKeep the long rep composed around 95 rpm and let cadence rise slightly on the short ones. ERG works if you can hold cadence through the increases. Use late in build and replace the second pyramid with easy riding if the first is already near your limit.',
    tags: ['indoor', 'build', 'pyramid', 'long'],
    items: [
      repeat(2, aerobic(240, 107), easy(150), aerobic(180, 111), easy(120),
        aerobic(120, 116), easy(90), aerobic(60, 124), easy(240)),
      cruise(10, 65),
    ],
  }),
  cycling({
    slug: 'quick-lit-climb',
    name: 'Quick-Lit Climb',
    category: 'vo2max',
    level: 'advanced',
    summary: 'Five hard-start efforts open briskly before settling into sustained VO2 power.',
    description: 'A firm opening can bring oxygen uptake up sooner. Back off after twenty-five seconds so there is enough reserve to hold the rest of the rep.\n\nAim near 100 rpm on entry and settle into a comfortable seated rhythm. Resistance mode makes the drop easier to time. Use after mastering even-paced efforts in a build. Reduce the opening target first if you cannot settle into the main effort.',
    tags: ['indoor', 'build', 'hard-start', 'erg-off'],
    items: [
      repeat(5, aerobic(25, 125, 'Open firmly and leave room to settle.'),
        aerobic(185, 109, 'Ease into steady power and keep your cadence.'), easy(210)),
    ],
  }),
  cycling({
    slug: 'vented-plateau',
    name: 'Vented Plateau',
    category: 'vo2max',
    level: 'advanced',
    summary: 'Six four-minute efforts anchor a long ride with endurance before and after.',
    description: 'Start with easy endurance, then accumulate high-aerobic work in long, even reps while your legs are warm. Return to easy endurance once the interval work is done.\n\nSpin around 95 rpm on the efforts and use ERG if you can keep cadence steady. Use as a key late-build session with easy days around it. Skip the sixth rep or shorten the final endurance block to scale.',
    tags: ['indoor', 'long', 'build', 'endurance'],
    items: [cruise(15, 65), intervals(6, aerobic(240, 109), 150), cruise(13, 63)],
  }),
  cycling({
    slug: 'minute-matchsticks',
    name: 'Minute Matchsticks',
    category: 'anaerobic',
    level: 'intermediate',
    summary: 'Five hard one-minute efforts build anaerobic capacity with generous recovery.',
    description: 'A hard minute draws heavily on anaerobic energy while aerobic demand climbs. Three easy minutes between reps help keep the output repeatable.\n\nBuild to power smoothly at 95–105 rpm and hold it to the end. Use resistance mode if ERG bogs you down. Try during build once you can pace shorter efforts, and stop after four if the final seconds fade sharply.',
    tags: ['indoor', 'build', 'anaerobic-capacity'],
    items: [intervals(5, attack(60, 133), 180)],
  }),
  cycling({
    slug: 'furnace-drafts',
    name: 'Furnace Drafts',
    category: 'anaerobic',
    level: 'advanced',
    summary: 'Two small clusters of hard minutes train repeatability at race-attack power.',
    description: 'The opening cluster stresses anaerobic capacity. Longer mid-session recovery lets you deliver a slightly stronger second cluster.\n\nStay seated around 100 rpm and avoid a spike at the start. Use resistance mode and aim for a flat power trace. Schedule in late build or race preparation and drop the last rep if your power falls off.',
    tags: ['indoor', 'build', 'race-prep', 'erg-off'],
    items: [intervals(3, attack(60, 138), 150), easy(300), intervals(3, attack(60, 142), 150)],
  }),
  cycling({
    slug: 'ten-second-airlock',
    name: 'Ten-Second Airlock',
    category: 'anaerobic',
    level: 'advanced',
    summary: 'Two tightly capped 20/10 sets rehearse hard surges on little recovery.',
    description: 'The short rests compound fatigue quickly, so the power is capped and each set has only five reps. Expect both aerobic and anaerobic demand to build.\n\nUse resistance mode and keep the pedals moving around 100 rpm through each transition. Use sparingly during peak preparation after you have practiced longer recovery intervals. Start with one set and finish early if cadence or control drops.',
    tags: ['indoor', 'short', 'peak', 'erg-off', 'microbursts'],
    items: [intervals(5, attack(20, 140), 10), easy(420), intervals(5, attack(20, 145), 10)],
  }),
  cycling({
    slug: 'copper-shears',
    name: 'Copper Shears',
    category: 'anaerobic',
    level: 'intermediate',
    summary: 'Six forty-five-second efforts train controlled accelerations with ample reset time.',
    description: 'Forty-five seconds at high power challenges anaerobic capacity without the pacing demands of a full minute. Give each recovery enough attention to start fresh.\n\nStay seated and build toward 100 rpm through the first few seconds. Ride in resistance mode for clean transitions. Use as an early race-prep session and do four reps on your first attempt if repeatability is uncertain.',
    tags: ['indoor', 'build', 'race-prep', 'erg-off'],
    items: [intervals(6, attack(45, 140), 165)],
  }),
  cycling({
    slug: 'sliding-fuse',
    name: 'Sliding Fuse',
    category: 'anaerobic',
    level: 'advanced',
    summary: 'Two descending sets move from a sustained attack to a sharper finish.',
    description: 'Each set starts with a hard minute, then shifts to forty and twenty-five seconds at progressively higher power. The easy sections preserve enough capacity for those sharper efforts.\n\nSpin up toward 105 rpm in resistance mode before each hit. Use this late in a race-specific block and try a single set first if you are new to changing power within a session.',
    tags: ['indoor', 'race-prep', 'pyramid', 'erg-off'],
    items: [
      repeat(2, attack(60, 131), easy(180), attack(40, 147), easy(170), attack(25, 158), easy(245)),
    ],
  }),
  cycling({
    slug: 'last-lap-matches',
    name: 'Last-Lap Matches',
    category: 'anaerobic',
    level: 'advanced',
    summary: 'Seven hard minutes test whether race-attack power holds up after steady riding.',
    description: 'Steady endurance adds some fatigue before the hard minutes, which stress the ability to deliver repeated power well above FTP. The final easy cruise extends aerobic volume.\n\nRide the attacks near 100 rpm in resistance mode and keep the first minute in reserve. Schedule late in race preparation with an easy following day. Remove the last two attacks to keep the total work manageable.',
    tags: ['indoor', 'long', 'race-prep', 'erg-off'],
    items: [cruise(19, 66), intervals(7, attack(60, 135), 180), cruise(13, 64)],
  }),
  cycling({
    slug: 'rolling-toe-in',
    name: 'Rolling Toe-In',
    category: 'sprint',
    level: 'beginner',
    summary: 'Four seated ten-second accelerations teach smooth sprint mechanics.',
    description: 'Short controlled bursts train recruitment and coordination with little sustained fatigue. Easy spinning between bursts gives the legs time to reset.\n\nTurn ERG off, begin in a comfortable rolling gear, and let cadence climb to about 105 rpm. Use early in a build after learning the trainer controls. Start near the bottom of the range or ride three bursts if your hips start to bounce.',
    tags: ['indoor', 'short', 'build', 'sprint', 'erg-off'],
    items: [intervals(4, sprint(10, 150, 175), 170)],
  }),
  cycling({
    slug: 'pedal-rise',
    name: 'Pedal Rise',
    category: 'sprint',
    level: 'intermediate',
    summary: 'Five ten-second standing sprints sharpen the transition out of the saddle.',
    description: 'Brief standing sprints recruit high power while long easy spins allow partial phosphocreatine recovery between efforts. Each rep begins with the bike already rolling.\n\nUse resistance mode on a stable trainer and rise smoothly around 85–95 rpm. Use this in build when fresh. Ride seated or stay at the bottom of the target range if the standing transition feels awkward.',
    tags: ['indoor', 'build', 'sprint', 'standing', 'erg-off'],
    items: [intervals(5, sprint(10, 180, 220, true), 230)],
  }),
  cycling({
    slug: 'flywheel-strike',
    name: 'Flywheel Strike',
    category: 'sprint',
    level: 'advanced',
    summary: 'Six ten-second seated sprints pair fast cadence with full easy resets.',
    description: 'These brief efforts emphasize rapid force production and a clean acceleration. Give yourself the long easy spin so each burst can be crisp.\n\nUse resistance mode and select a gear that lets cadence rise toward 115 rpm without bouncing. Place this in a low-volume peak week. Treat the upper target as optional and end the set if acceleration clearly fades.',
    tags: ['indoor', 'peak', 'sprint', 'erg-off'],
    items: [intervals(6, sprint(10, 220, 300), 260)],
  }),
  cycling({
    slug: 'gantry-launch',
    name: 'Gantry Launch',
    category: 'sprint',
    level: 'advanced',
    summary: 'Five fifteen-second standing launches rehearse a strong acceleration from a rolling gear.',
    description: 'Fifteen seconds extends the sprint beyond the initial jump and asks you to carry speed as anaerobic demand builds. Long recovery keeps each launch technically sharp.\n\nWith ERG off, rise around 85–90 rpm and accelerate toward 100 rpm on a stable trainer. Use in race preparation. Shorten the efforts to ten seconds if you start pulling hard on the bars or lose control.',
    tags: ['indoor', 'race-prep', 'sprint', 'standing', 'erg-off'],
    items: [intervals(5, sprint(15, 195, 250, true), 285)],
  }),
  cycling({
    slug: 'high-gear-release',
    name: 'High Gear Release',
    category: 'sprint',
    level: 'advanced',
    summary: 'Four controlled twenty-second standing sprints develop the ability to carry an acceleration.',
    description: 'The longer bursts stress sprint durability after the initial jump. The target range allows you to keep the whole effort smooth despite rising glycolytic demand.\n\nRide in resistance mode on a stable trainer and keep cadence moving through roughly 85–105 rpm. Use for late race prep after shorter standing sprints. Reduce to fifteen seconds or sit down if form starts to go.',
    tags: ['indoor', 'race-prep', 'sprint', 'standing', 'erg-off'],
    items: [intervals(4, sprint(20, 160, 200, true), 340), cruise(8, 63)],
  }),
  cycling({
    slug: 'two-gear-sparks',
    name: 'Two-Gear Sparks',
    category: 'sprint',
    level: 'intermediate',
    summary: 'Seated and standing sprint blocks let you practice both kinds of launch.',
    description: 'Seated accelerations emphasize leg speed, followed by rolling standing starts that add a different coordination demand. Long recoveries preserve quality in both blocks.\n\nSwitch ERG off for the session. Aim around 110 rpm seated and closer to 95 rpm standing. Use in a build before combining sprints with race surges. Skip the final standing rep if your last launch felt unsteady.',
    tags: ['indoor', 'build', 'sprint', 'standing', 'erg-off'],
    items: [intervals(3, sprint(10, 170, 210), 200), easy(180), intervals(3, sprint(10, 175, 215, true), 230)],
  }),
  cycling({
    slug: 'quiet-road-sparks',
    name: 'Quiet Road Sparks',
    category: 'mixed',
    level: 'beginner',
    summary: 'Four controlled seated accelerations break up an easy endurance ride.',
    description: 'Keep the steady portions aerobic and use the brief jumps to practice recruiting power from a rolling pace. Easy spinning after each jump preserves the endurance feel.\n\nCruise at 85–95 rpm and let cadence rise smoothly over 100 rpm during each acceleration. Turn ERG off before the first jump. Use during base or early build, and replace the final two jumps with easy riding if your form fades.',
    tags: ['indoor', 'endurance', 'sprint', 'erg-off'],
    items: [cruise(8, 64), repeat(4, cruise(4, 66), sprint(10, 150, 175), easy(110))],
  }),
  cycling({
    slug: 'corner-exit-thread',
    name: 'Corner Exit Thread',
    category: 'mixed',
    level: 'intermediate',
    summary: 'Two simulated criterium blocks alternate short corner exits with steady pressure and easy floats.',
    description: 'Practice accelerating out of an imaginary corner and settling back into the pack. Each short jump draws on anaerobic capacity while the steady riding keeps aerobic work going.\n\nUse resistance mode and accelerate seated from a rolling gear toward 105 rpm. Return promptly to 85–95 rpm on the steady section. Use when preparing for a criterium and shorten the second block by two laps if the exits lose snap.',
    tags: ['indoor', 'race-prep', 'criterium', 'erg-off'],
    items: [
      repeat(6, attack(15, 150), cruise(1, 86), easy(45, 60)),
      easy(360),
      repeat(7, attack(15, 155), cruise(1, 88), easy(45, 60)),
    ],
  }),
  cycling({
    slug: 'headland-relay',
    name: 'Headland Relay',
    category: 'mixed',
    level: 'intermediate',
    summary: 'Endurance riding frames a series of controlled attacks and tempo pulls.',
    description: 'A brief attack starts each pull and raises the cost of the tempo that follows. The longer easy spin makes it possible to rehearse the same transition several times.\n\nRide the attack around 100 rpm before backing off to an even 85–95 rpm for the pull. Use resistance mode so the shifts happen on time. Place this in mid-build before sustained race simulation, and omit the fifth pull or shorten the opening endurance block to scale.',
    tags: ['indoor', 'long', 'build', 'race-prep', 'erg-off'],
    items: [
      cruise(18, 65),
      repeat(5, attack(30, 130), cruise(3, 86), easy(150, 55)),
      cruise(12, 65),
    ],
  }),
  cycling({
    slug: 'outer-ring-rehearsal',
    name: 'Outer Ring Rehearsal',
    category: 'mixed',
    level: 'advanced',
    summary: 'Two criterium blocks punctuate a two-hour endurance ride with repeated corner accelerations.',
    description: 'Ride into two simulated stretches of a criterium, each with seven accelerations from rolling speed. The jumps tax anaerobic reserves and settling into the pack pace lets you practice recovering while still producing power.\n\nSwitch ERG off before the first block. Build toward 105 rpm on the exits, then hold a smooth 85–95 rpm during each tempo section and use the easy minutes to drink. Keep the endurance blocks easy enough to speak comfortably.\n\nUse this late in criterium preparation with an easy day after it. Replace the second block with endurance if the exits lose snap, or trim the closing endurance for a shorter ride.',
    tags: ['indoor', 'long', 'race-prep', 'criterium', 'erg-off'],
    items: [
      cruise(24, 66),
      repeat(7, attack(20, 150), cruise(1, 87), easy(40, 58)),
      easy(360),
      cruise(16, 66),
      repeat(7, attack(20, 155), cruise(1, 89), easy(40, 58)),
      easy(360),
      cruise(22, 65),
    ],
  }),
  cycling({
    slug: 'far-marker-finale',
    name: 'Far Marker Finale',
    category: 'mixed',
    level: 'advanced',
    summary: 'A two-hour road-race simulation pairs sustained pulls with late attacks and a finish sprint.',
    description: 'Start with endurance, then work through three long race blocks. A hard minute opens each block, followed by tempo, a short supra-threshold push and more steady riding. This rehearses settling after an attack and producing power again as fatigue builds.\n\nUse resistance mode for the race blocks and sprint. Hold about 100 rpm on the attacks and 85–95 rpm on the pulls. Drink and fuel during the easier stretches, and accelerate seated into the finish sprint.\n\nUse late in road-race preparation after shorter rehearsals. Replace the third race block with easy endurance or skip the sprint if your legs can no longer accelerate smoothly.',
    tags: ['indoor', 'long', 'race-prep', 'sprint', 'erg-off'],
    items: [
      cruise(32, 66),
      repeat(3, attack(60, 130), cruise(5, 84), aerobic(120, 110), cruise(4, 77), easy(300, 55)),
      cruise(14, 64),
      sprint(15, 180, 225),
      easy(285),
    ],
  }),
];
