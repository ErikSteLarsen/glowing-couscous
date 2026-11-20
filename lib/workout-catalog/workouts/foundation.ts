import type {
  CatalogItem,
  CatalogStep,
  CatalogStepKind,
  CatalogWorkout,
} from "../types.ts";

/**
 * Foundation workouts: recovery, endurance, tempo, cadence skills and tests.
 * All targets are % of FTP. Durations are authored in minutes (fractions of
 * 0.25 allowed) and converted to seconds, so every step is a multiple of 15 s.
 */

type Cadence = [number, number];

function step(
  kind: CatalogStepKind,
  minutes: number,
  lowPct: number,
  highPct: number,
  cue?: string,
  cadence?: Cadence,
): CatalogStep {
  return {
    kind,
    durationSec: Math.round(minutes * 60),
    lowPct,
    highPct,
    ...(cadence ? { cadence } : {}),
    ...(cue ? { cue } : {}),
  };
}

/** Warmup ramps low -> high. */
const warm = (
  m: number,
  low: number,
  high: number,
  cue?: string,
  cad?: Cadence,
) => step("warmup", m, low, high, cue, cad);
/** Steady (or ranged) work. */
const work = (
  m: number,
  pct: number,
  cue?: string,
  cad?: Cadence,
  highPct: number = pct,
) => step("work", m, pct, highPct, cue, cad);
/** Easy riding between efforts. */
const easy = (m: number, pct: number, cue?: string, cad?: Cadence) =>
  step("recovery", m, pct, pct, cue, cad);
/** Cooldown falls high -> low. */
const cool = (m: number, high: number, low: number, cue?: string) =>
  step("cooldown", m, low, high, cue);

const paras = (...p: string[]) => p.join("\n\n");

/** Seven-step cadence pyramid at a fixed power. */
function pyramid(minutesPerStep: number, pct: number): CatalogStep[] {
  return [80, 90, 100, 110, 100, 90, 80].map((rpm) =>
    work(
      minutesPerStep,
      pct,
      `${rpm} rpm. Stay smooth, no bouncing in the saddle.`,
      [rpm - 3, rpm + 3],
    ),
  );
}

/** One-minute ramp-test steps from `startPct`, rising `stepPct` each minute. */
function rampSteps(
  startPct: number,
  stepPct: number,
  count: number,
): CatalogStep[] {
  return Array.from({ length: count }, (_, i) => {
    const pct = startPct + i * stepPct;
    return work(
      1,
      pct,
      i === 0 ? "Ramp starts here. Steps rise every minute." : undefined,
    );
  });
}

const rampItems: CatalogItem[] = rampSteps(50, 6, 21);

export const foundationWorkouts: CatalogWorkout[] = [
  // ---------------------------------------------------------------- recovery
  {
    slug: "gentle-spin-30",
    name: "Gentle Spin",
    sport: "BIKING",
    category: "recovery",
    level: "beginner",
    summary:
      "A 30-minute conversational spin to loosen the legs without adding fatigue.",
    description: paras(
      "Purpose: an easy half hour that moves blood through tired legs and keeps the habit alive on a rest or light day. Nothing here should feel like training.",
      "Physiology: at 50% of FTP you sit well below the first lactate turn point. Muscles get a gentle pump and capillary flow rises, which helps clear metabolic by-products while adding almost no recovery cost.",
      "Execution: keep cadence light and even, roughly 85-95 rpm, with shoulders and hands relaxed. If you are breathing hard you are going too fast. Use ERG mode if you like, but resistance should feel almost absent; freewheel-style effort is the goal.",
      "When in plan: the day after a hard session or a long ride, or as a first ride back after time off. Scaling: if 50% still feels hard, drop to 45% and keep the duration.",
    ),
    tags: ["indoor", "short", "recovery", "easy", "beginner-friendly"],
    items: [
      warm(
        5,
        40,
        50,
        "Spin up gradually. Loose grip, relaxed shoulders.",
        [85, 95],
      ),
      work(20, 50, "Conversational pace. You could sing along.", [85, 95]),
      cool(5, 50, 40, "Soft pedalling. Done."),
    ],
  },
  {
    slug: "legs-flush-45",
    name: "Legs Flush",
    sport: "BIKING",
    category: "recovery",
    level: "beginner",
    summary:
      "A 45-minute very easy ride with a slightly firmer middle to shake out heavy legs.",
    description: paras(
      "Purpose: promote recovery after a demanding day while giving a little more structure than a plain spin.",
      "Physiology: staying at 50-55% of FTP keeps energy demand low and fat oxidation dominant. The small step up to 55% adds gentle muscle perfusion without a meaningful training stimulus.",
      "Execution: ride the middle block only slightly firmer than the rest. Keep cadence comfortable at 85-95 rpm, sit mostly seated, and keep your breathing nasal or fully conversational. ERG mode is fine because the targets are low and steady.",
      "When in plan: after interval days or a hard weekend. Scaling: shorten the 55% block or skip it if your legs feel flat; extend the final 50% block to add time.",
    ),
    tags: ["indoor", "recovery", "easy", "beginner-friendly"],
    items: [
      warm(5, 40, 50, undefined, [85, 95]),
      work(15, 50, "Easy. Let the legs turn over by themselves.", [85, 95]),
      work(
        10,
        55,
        "Slightly firmer, but still easy and conversational.",
        [85, 95],
      ),
      work(10, 50, "Back to very easy.", [85, 95]),
      cool(5, 50, 40),
    ],
  },
  {
    slug: "recovery-spin-with-cadence-play-45",
    name: "Recovery Spin with Cadence Play",
    sport: "BIKING",
    category: "recovery",
    level: "intermediate",
    summary:
      "Forty-five easy minutes with a smooth one-minute spin every five minutes to keep pedalling fluid.",
    description: paras(
      "Purpose: recover while rehearsing smooth, quick pedalling so cadence skills do not fade on easy weeks.",
      "Physiology: the brief 105-110 rpm spins raise neuromuscular coordination demand but at only about 53% of FTP the metabolic and muscular cost stays tiny. Lower torque at high cadence is easy on the joints and muscles.",
      "Execution: ride four minutes at a comfortable 85-90 rpm, then one minute of fast, light pedalling at 105-110 rpm. Keep your hips quiet and your upper body relaxed; if you bounce, back off 5 rpm. Resistance should stay light, so ERG mode is fine as long as it follows quickly.",
      "When in plan: a recovery day mid-week or the day after intervals. Scaling: cap the spin cadence at 100 rpm if you are new to fast pedalling.",
    ),
    tags: ["indoor", "recovery", "cadence", "easy"],
    items: [
      warm(5, 40, 50, undefined, [85, 90]),
      {
        repeat: 6,
        steps: [
          work(4, 50, "Easy, relaxed legs.", [85, 90]),
          work(1, 53, "Spin it quick and light. No bouncing.", [105, 110]),
        ],
      },
      work(5, 50, "Easy again. Keep it loose.", [85, 90]),
      cool(5, 50, 40),
    ],
  },
  {
    slug: "day-after-reset-60",
    name: "Day-After Reset",
    sport: "BIKING",
    category: "recovery",
    level: "beginner",
    summary:
      "A relaxed 60-minute ride to settle the body after a hard effort or long day.",
    description: paras(
      "Purpose: a longer recovery option for athletes who feel better with an hour of easy movement than with a day fully off.",
      "Physiology: keeping to 50-55% of FTP maintains circulation and aerobic enzyme activity without adding glycogen depletion or muscle damage. The gentle variation helps hold attention without raising effort.",
      "Execution: stay seated, cadence 85-95 rpm, breathing fully conversational. The 55% block is the ceiling; do not let it creep higher. ERG mode works well here because it prevents the common mistake of drifting too hard.",
      "When in plan: after a race, a big training day or a long ride. Scaling: take 15 minutes off the final 50% block for a 45-minute version.",
    ),
    tags: ["indoor", "recovery", "easy", "beginner-friendly"],
    items: [
      warm(5, 40, 50, undefined, [85, 95]),
      work(20, 50, "Very easy. This is recovery, not training.", [85, 95]),
      work(10, 55, "Top of the range. Stay conversational.", [85, 95]),
      work(15, 50, "Easy again.", [85, 95]),
      work(5, 48, undefined, [85, 95]),
      cool(5, 48, 40),
    ],
  },
  {
    slug: "loosen-up-spin-ups-30",
    name: "Loosen-Up Spin-Ups",
    sport: "BIKING",
    category: "recovery",
    level: "intermediate",
    summary:
      "A short recovery ride with five 1-minute fast-leg spin-ups to refresh stiff legs.",
    description: paras(
      "Purpose: wake up tired legs and keep leg speed ticking over on a recovery day.",
      "Physiology: short bouts of high cadence at very low load recruit fast-twitch fibres lightly and encourage quick muscle relaxation between contractions, without a meaningful metabolic cost.",
      "Execution: spin up smoothly to 100-110 rpm for each minute, then drop back to 85-90 rpm and let the heart rate settle. The power targets are tiny, so keep your eyes on cadence and smoothness. ERG mode may fight the cadence changes; use it only if it responds quickly, otherwise ride on resistance feel.",
      "When in plan: the day before a key session or as a recovery day. Scaling: reduce to three spin-ups for a 22-minute version.",
    ),
    tags: ["indoor", "short", "recovery", "cadence"],
    items: [
      warm(5, 40, 50, undefined, [85, 90]),
      {
        repeat: 5,
        steps: [
          work(1, 52, "Spin up smoothly. Quiet upper body.", [100, 110]),
          easy(3, 48, "Settle back and breathe.", [85, 90]),
        ],
      },
      cool(5, 48, 40),
    ],
  },
  {
    slug: "slow-roll-75",
    name: "Slow Roll",
    sport: "BIKING",
    category: "recovery",
    level: "intermediate",
    summary:
      "A 75-minute very easy ride for recovery weeks when you want time on the bike without stress.",
    description: paras(
      "Purpose: a longer recovery ride to keep volume up during a rest or deload week.",
      "Physiology: at 52-55% of FTP the load is low enough that glycogen use stays minimal and the session can be repeated across days. It trains basic aerobic habits while the body absorbs earlier training.",
      "Execution: keep both halves steady. Stay seated, relax the shoulders, and use 85-95 rpm. Take a drink every 15 minutes. ERG mode is fine; stay out of the habit of nudging the target upward.",
      "When in plan: a deload week or the day after a long ride. Scaling: split into two 30-minute sessions or drop to 50% if you are fatigued.",
    ),
    tags: ["indoor", "long", "recovery", "easy", "base"],
    items: [
      warm(5, 40, 52, undefined, [85, 95]),
      work(30, 52, "Easy and relaxed. Drink regularly.", [85, 95]),
      work(30, 55, "Still easy. Do not let it creep up.", [85, 95]),
      cool(10, 52, 40, "Soft spin to finish."),
    ],
  },

  // --------------------------------------------------------------- endurance
  {
    slug: "steady-aerobic-hour-60",
    name: "Steady Aerobic Hour",
    sport: "BIKING",
    category: "endurance",
    level: "beginner",
    summary:
      "A single steady hour at an easy aerobic pace for building a base.",
    description: paras(
      "Purpose: the foundational endurance session. A steady hour at 65% of FTP builds the aerobic engine with minimal fatigue.",
      "Physiology: riding in the endurance zone drives mitochondrial and capillary adaptations and improves fat oxidation. Intensity is low enough to recover quickly, so frequency matters more than effort.",
      "Execution: after a progressive warmup, hold 65% with a cadence of 85-95 rpm. You should be able to talk in full sentences. ERG mode keeps the effort honest and prevents drifting upward. If heart rate climbs steadily in the last 15 minutes, that is normal cardiac drift.",
      "When in plan: the staple of a base phase, two to four times a week. Scaling: new riders can start at 60%; stronger riders can push to 70% or extend the main block.",
    ),
    tags: ["indoor", "base", "endurance", "beginner-friendly"],
    items: [
      warm(10, 45, 62, "Build gradually. Spin easily.", [85, 95]),
      work(40, 65, "Steady and conversational. Smooth pedal stroke.", [85, 95]),
      cool(10, 60, 45),
    ],
  },
  {
    slug: "compact-aerobic-builder-45",
    name: "Compact Aerobic Builder",
    sport: "BIKING",
    category: "endurance",
    level: "intermediate",
    summary:
      "A time-efficient 45-minute endurance ride with brief lifts to keep the aerobic system engaged.",
    description: paras(
      "Purpose: get quality aerobic stimulus when you only have 45 minutes.",
      "Physiology: the base is steady Z2 work at 68%, with one-minute lifts to 74% to nudge aerobic stress slightly higher without leaving the endurance zone.",
      "Execution: ride each eight-minute block at 68% and 90 rpm. On the lift, increase effort by just a few percent and keep cadence the same. Use ERG mode and let it make the change for you.",
      "When in plan: busy weeks in a base phase. Scaling: skip the lifts for a pure steady ride, or add a fourth block to extend to about 55 minutes.",
    ),
    tags: ["indoor", "short", "base", "time-crunched", "endurance"],
    items: [
      warm(10, 45, 65, undefined, [85, 95]),
      {
        repeat: 3,
        steps: [
          work(8, 68, "Steady Z2. Breathe easy.", [88, 95]),
          work(1, 74, "Small lift. Same cadence.", [88, 95]),
        ],
      },
      cool(8, 60, 45),
    ],
  },
  {
    slug: "aerobic-base-90",
    name: "Aerobic Base 90",
    sport: "BIKING",
    category: "endurance",
    level: "intermediate",
    summary:
      "Ninety minutes of steady Z2 with a slightly stronger second half.",
    description: paras(
      "Purpose: a classic base-building ride that develops aerobic durability and the ability to sit comfortably for an extended time.",
      "Physiology: long sessions at 66-70% of FTP stress fat metabolism and slow-twitch fibres heavily, and they train the body to hold form and fuel use as fatigue grows.",
      "Execution: ride the first half at 66% and the second half at 70%, both at 85-95 rpm. Eat and drink on a schedule, about every 20 minutes. Keep ERG mode on to hold the pace evenly.",
      "When in plan: one to two times a week in base. Scaling: ride the whole block at 66% when tired, or at 72% when fresh.",
    ),
    tags: ["indoor", "base", "endurance", "long"],
    items: [
      warm(12, 45, 65, undefined, [85, 95]),
      work(33, 66, "Settle in. Easy breathing, relaxed hands.", [85, 95]),
      work(33, 70, "Slightly firmer, still steady.", [85, 95]),
      cool(12, 60, 45),
    ],
  },
  {
    slug: "stair-step-endurance-75",
    name: "Stair-Step Endurance",
    sport: "BIKING",
    category: "endurance",
    level: "intermediate",
    summary:
      "A progressive 75-minute endurance ride that climbs from 58% to 72% in four equal steps.",
    description: paras(
      "Purpose: teach pacing and let the body ramp aerobic load gradually while staying inside the endurance zone.",
      "Physiology: starting low and finishing near the top of Z2 raises aerobic stress progressively. The last block, ridden pre-fatigued, builds durability at the same power.",
      "Execution: hold each 15-minute step steadily; ERG mode makes the transitions clean. Keep cadence at 88-95 rpm. The final step should feel like work but still be sustainable and nasal-breathing friendly.",
      "When in plan: mid base phase, once or twice a week. Scaling: cap the top step at 68% if tired, or lengthen each step to 20 minutes for a 95-minute ride.",
    ),
    tags: ["indoor", "base", "endurance", "progressive"],
    items: [
      warm(10, 45, 58, undefined, [85, 95]),
      work(15, 58, "Step 1. Very comfortable.", [88, 95]),
      work(15, 63, "Step 2. Light work.", [88, 95]),
      work(15, 68, "Step 3. Solid aerobic.", [88, 95]),
      work(15, 72, "Step 4. Top of Z2. Stay smooth.", [88, 95]),
      cool(5, 55, 45),
    ],
  },
  {
    slug: "endurance-with-tempo-touches-90",
    name: "Endurance with Tempo Touches",
    sport: "BIKING",
    category: "endurance",
    level: "intermediate",
    summary:
      "Ninety minutes of Z2 with three 10-minute tempo blocks at 80% to bridge into harder work.",
    description: paras(
      "Purpose: add a taste of tempo to a base ride to prepare for structured tempo and sweet-spot work.",
      "Physiology: the 80% blocks raise aerobic and glycolytic demand modestly and boost the ability to ride longer at higher power, while the easy riding between them preserves recovery.",
      "Execution: ride each tempo block at 80%, cadence 85-95 rpm, then settle back to 60% to recover fully for eight minutes. ERG mode is helpful because the changes are clear and long enough for it to follow.",
      "When in plan: late base. Scaling: reduce to two blocks for a shorter ride, or raise each block to 12 minutes for more stimulus.",
    ),
    tags: ["indoor", "base", "endurance", "tempo", "long"],
    items: [
      warm(12, 45, 65, undefined, [85, 95]),
      {
        repeat: 3,
        steps: [
          work(10, 80, "Tempo. Controlled and rhythmic.", [85, 95]),
          easy(8, 60, "Back to easy. Drink and breathe.", [85, 95]),
        ],
      },
      work(12, 65, "Steady Z2 to finish.", [85, 95]),
      cool(12, 60, 45),
    ],
  },
  {
    slug: "two-hour-aerobic-steady-120",
    name: "Two-Hour Aerobic Steady",
    sport: "BIKING",
    category: "endurance",
    level: "intermediate",
    summary:
      "Two hours of Z2 with a stronger middle block to build durability.",
    description: paras(
      "Purpose: a long steady ride that builds aerobic endurance without needing hard efforts.",
      "Physiology: the 70% block deepens the aerobic stimulus, while the softer first and last blocks keep overall load manageable and teach fuelling and pacing.",
      "Execution: ride 65% for 30 minutes, 70% for 40 minutes, then 65% for 20. Keep cadence at 85-95 rpm and eat about 40-60 g of carbohydrate per hour. ERG mode is useful for even pacing across a long ride.",
      "When in plan: weekly long ride in base. Scaling: ride flat at 65% if tired or extend the middle block for longer sessions.",
    ),
    tags: ["indoor", "long", "base", "endurance"],
    items: [
      warm(15, 45, 65, undefined, [85, 95]),
      work(30, 65, "Easy start. Fuel early.", [85, 95]),
      work(40, 70, "Firm but steady aerobic.", [85, 95]),
      work(20, 65, "Settle back. Stay smooth.", [85, 95]),
      cool(15, 60, 45),
    ],
  },
  {
    slug: "endurance-waves-110",
    name: "Endurance Waves",
    sport: "BIKING",
    category: "endurance",
    level: "advanced",
    summary:
      "Six repeats of ten minutes at 66% rolling into five minutes at 74% for a varied long endurance ride.",
    description: paras(
      "Purpose: add rhythm to a long ride so it holds attention and develops the ability to change pace without leaving the aerobic zone.",
      "Physiology: alternating 66% and 74% keeps the ride inside the endurance zone while the upper wave pushes aerobic stress slightly higher, and the lower wave allows recovery.",
      "Execution: stay seated and smooth through both parts of each wave, cadence 88-95 rpm. Resist the temptation to push the upper wave above 75%. ERG mode follows these transitions well.",
      "When in plan: a mid-base long ride. Scaling: do four waves for 90 minutes, or add a seventh for a longer session.",
    ),
    tags: ["indoor", "long", "base", "endurance", "variable"],
    items: [
      warm(12, 45, 65, undefined, [85, 95]),
      {
        repeat: 6,
        steps: [
          work(10, 66, "Lower wave. Easy and flowing.", [88, 95]),
          work(5, 74, "Upper wave. Firm but under control.", [88, 95]),
        ],
      },
      cool(8, 60, 45),
    ],
  },
  {
    slug: "long-aerobic-day-150",
    name: "Long Aerobic Day",
    sport: "BIKING",
    category: "endurance",
    level: "advanced",
    summary:
      "Two and a half hours of steady endurance with a gentle alternation between 62% and 68%.",
    description: paras(
      "Purpose: build long-ride durability for riders preparing for events or high weekly volume.",
      "Physiology: prolonged riding at 62-68% of FTP trains fat use, depletes glycogen moderately and improves the body's ability to maintain form and efficiency over time.",
      "Execution: alternate 30-minute blocks at 62% and 68% with cadence at 85-95 rpm. Fuel every 20 minutes at 60 g of carbohydrate per hour and drink regularly. Stand briefly every 30 minutes for comfort. ERG mode helps keep pacing disciplined for the full duration.",
      "When in plan: a weekly long ride in base or build phases. Scaling: ride the whole block at 62% when fatigued, or shorten blocks to 25 minutes for about two hours.",
    ),
    tags: ["indoor", "long", "base", "endurance"],
    items: [
      warm(15, 45, 62, undefined, [85, 95]),
      work(30, 62, "Easy start. Eat and drink early.", [85, 95]),
      work(30, 68, "Steady Z2.", [85, 95]),
      work(30, 62, "Ease back. Check your posture.", [85, 95]),
      work(30, 68, "Steady Z2. Stay smooth.", [85, 95]),
      cool(15, 60, 45),
    ],
  },
  {
    slug: "long-progressive-build-165",
    name: "Long Progressive Build",
    sport: "BIKING",
    category: "endurance",
    level: "advanced",
    summary:
      "A 165-minute endurance ride that rises from 60% to 72% in four blocks for late-ride strength.",
    description: paras(
      "Purpose: build the ability to ride strongly late in a long session by finishing at the top of the endurance zone.",
      "Physiology: starting conservatively saves glycogen, while the final blocks at 68-72% add aerobic stress under accumulated fatigue, which improves durability and fuel efficiency.",
      "Execution: hold each 35-minute block steadily at 85-95 rpm. The final block should feel noticeably firmer but never reach threshold effort. Keep fuelling steady throughout. ERG mode is recommended for control.",
      "When in plan: a long ride in base or early build. Scaling: cap the final block at 68% if tired, or drop to three blocks for about two hours.",
    ),
    tags: ["indoor", "long", "base", "endurance", "progressive"],
    items: [
      warm(15, 45, 60, undefined, [85, 95]),
      work(35, 60, "Block 1. Very easy; save it.", [85, 95]),
      work(35, 65, "Block 2. Settle in.", [85, 95]),
      work(35, 68, "Block 3. Steady aerobic.", [85, 95]),
      work(35, 72, "Block 4. Strong but sustainable.", [85, 95]),
      cool(10, 60, 45),
    ],
  },
  {
    slug: "three-hour-base-ride-180",
    name: "Three-Hour Base Ride",
    sport: "BIKING",
    category: "endurance",
    level: "advanced",
    summary:
      "A three-hour steady endurance ride with short easy breaks to reset between blocks.",
    description: paras(
      "Purpose: the longest endurance session in the library, for riders building toward long events or very high weekly volume.",
      "Physiology: extended time in the aerobic zone drives deep adaptations in fat metabolism, fatigue resistance and economy. Short breaks at 55% let you fuel and reset your posture.",
      "Execution: ride three blocks at 65-68% with cadence 85-95 rpm. Consume 60 g of carbohydrate per hour, drink regularly and use the breaks to stretch your back and shoulders. ERG mode keeps effort steady when concentration fades.",
      "When in plan: occasional peak-volume weekend ride. Scaling: replace the final block with 30 minutes for a 2 hour 40 minute ride, or shorten any block to cut time.",
    ),
    tags: ["indoor", "long", "base", "endurance", "volume"],
    items: [
      warm(15, 45, 62, undefined, [85, 95]),
      work(45, 65, "Block 1. Calm and steady.", [85, 95]),
      easy(5, 55, "Easy break. Eat and drink.", [85, 90]),
      work(45, 68, "Block 2. Smooth and relaxed.", [85, 95]),
      easy(5, 55, "Easy break. Stretch your back.", [85, 90]),
      work(50, 66, "Block 3. Finish strong but controlled.", [85, 95]),
      cool(15, 60, 45),
    ],
  },

  // ------------------------------------------------------------------- tempo
  {
    slug: "first-steps-tempo-60",
    name: "First Steps in Tempo",
    sport: "BIKING",
    category: "tempo",
    level: "beginner",
    summary: "Three eight-minute blocks at 77% to introduce tempo riding.",
    description: paras(
      "Purpose: introduce tempo effort in short, manageable blocks.",
      "Physiology: tempo riding at 76-80% of FTP raises aerobic load beyond endurance, improving muscular endurance and fuel efficiency, but remains well below threshold stress.",
      "Execution: ride each block at 77% with 85-95 rpm. Breathing should be deeper and rhythmic but you should still speak short sentences. Recover for four minutes at 55% between blocks. ERG mode is a good choice for holding steady power.",
      "When in plan: early base or the first time adding intensity. Scaling: shorten blocks to six minutes or add a fourth block when ready.",
    ),
    tags: ["indoor", "tempo", "base", "beginner-friendly"],
    items: [
      warm(14, 45, 65, undefined, [85, 95]),
      {
        repeat: 3,
        steps: [
          work(8, 77, "Tempo. Controlled and rhythmic breathing.", [85, 95]),
          easy(4, 55, "Easy. Let your breathing settle.", [85, 95]),
        ],
      },
      cool(10, 60, 45),
    ],
  },
  {
    slug: "four-tens-at-tempo-75",
    name: "Four Tens at Tempo",
    sport: "BIKING",
    category: "tempo",
    level: "intermediate",
    summary:
      "Four ten-minute tempo blocks at 83% with short recoveries in 75 minutes.",
    description: paras(
      "Purpose: build muscular endurance at a sustained moderate power in a compact session.",
      "Physiology: 83% of FTP sits in the upper tempo range, increasing time spent with elevated aerobic and glycolytic demand. It improves lactate clearance and the ability to hold a strong steady effort.",
      "Execution: ride each ten-minute block at 83%, cadence 85-92 rpm. Recover with four minutes at 55%. If the last block feels hard, reduce to 80% rather than stopping. ERG mode is recommended.",
      "When in plan: base to early build, once a week. Scaling: shorten to three blocks, or lengthen each block to 12 minutes.",
    ),
    tags: ["indoor", "tempo", "base", "build"],
    items: [
      warm(12, 45, 68, undefined, [85, 95]),
      {
        repeat: 4,
        steps: [
          work(10, 83, "Tempo. Smooth power, steady breathing.", [85, 92]),
          easy(4, 55, "Easy. Drink and shake out your legs.", [85, 95]),
        ],
      },
      cool(7, 60, 45),
    ],
  },
  {
    slug: "tempo-trio-90",
    name: "Tempo Trio",
    sport: "BIKING",
    category: "tempo",
    level: "intermediate",
    summary: "Three fifteen-minute blocks at 80% for a solid tempo day.",
    description: paras(
      "Purpose: develop aerobic strength through three sustained tempo efforts with partial recovery.",
      "Physiology: long blocks at 80% of FTP accumulate meaningful time in the tempo zone, improving muscular endurance and the efficiency of aerobic metabolism.",
      "Execution: ride each block at 80% with cadence 85-95 rpm. Use the five-minute breaks at 55% to eat and drink. Stay seated for most of each block and keep your upper body quiet. ERG mode is helpful.",
      "When in plan: mid base or build. Scaling: reduce to two blocks for a shorter session or push the blocks to 83% when fresh.",
    ),
    tags: ["indoor", "tempo", "base", "long"],
    items: [
      warm(15, 45, 68, undefined, [85, 95]),
      {
        repeat: 3,
        steps: [
          work(15, 80, "Tempo. Hold it steady.", [85, 95]),
          easy(5, 55, "Easy. Eat and drink.", [85, 95]),
        ],
      },
      cool(15, 60, 45),
    ],
  },
  {
    slug: "rising-tempo-90",
    name: "Rising Tempo",
    sport: "BIKING",
    category: "tempo",
    level: "advanced",
    summary:
      "A single continuous tempo block that steps from 76% to 87% in fifteen-minute stages.",
    description: paras(
      "Purpose: practise sustained tempo with built-in pacing discipline and a strong finish.",
      "Physiology: climbing across the whole tempo range gradually raises aerobic and glycolytic load, building muscular endurance and tolerance for sustained effort close to sweet spot.",
      "Execution: hold each step precisely; the first step should feel comfortable. Cadence 85-92 rpm. The last step at 87% is the hardest and should be controlled, not a surge. ERG mode makes the steps clean.",
      "When in plan: mid to late base for experienced riders. Scaling: keep to 80% at the top if fatigued, or add a fifth step at 87% for 15 more minutes.",
    ),
    tags: ["indoor", "tempo", "base", "progressive", "long"],
    items: [
      warm(15, 45, 68, undefined, [85, 95]),
      work(15, 76, "Step 1. Settle into tempo.", [85, 92]),
      work(15, 80, "Step 2. Firm and rhythmic.", [85, 92]),
      work(15, 84, "Step 3. Hard but controlled.", [85, 92]),
      work(15, 87, "Step 4. Strong finish. Stay smooth.", [85, 92]),
      cool(15, 60, 45),
    ],
  },
  {
    slug: "tempo-with-bursts-90",
    name: "Tempo with Bursts",
    sport: "BIKING",
    category: "tempo",
    level: "advanced",
    summary:
      "Four tempo blocks at 80% broken by three 30-second bursts each to practise surging and settling.",
    description: paras(
      "Purpose: simulate real riding where steady effort is punctuated by short accelerations, and practise returning to rhythm.",
      "Physiology: the 30-second bursts briefly spike anaerobic and neuromuscular demand on top of tempo load. Returning promptly to 80% teaches lactate clearance under ongoing effort.",
      "Execution: ride three minutes at 80%, burst for 30 seconds at 110% seated or standing, return to 80% immediately. Three bursts per block, then five minutes easy. Keep bursts controlled, not all-out. ERG mode can lag on short bursts; if it does, switch to resistance or slope mode for the bursts.",
      "When in plan: mid build for experienced riders. Scaling: lower bursts to 100% or reduce to three blocks.",
    ),
    tags: ["indoor", "tempo", "bursts", "build", "long"],
    items: [
      warm(10, 45, 68, undefined, [85, 95]),
      {
        repeat: 4,
        steps: [
          work(4, 80, "Tempo. Smooth and rhythmic.", [85, 95]),
          work(0.5, 110, "Burst! Accelerate hard but controlled.", [95, 105]),
          work(4, 80, "Settle back into tempo quickly.", [85, 95]),
          work(0.5, 110, "Burst!", [95, 105]),
          work(4, 80, "Back to rhythm.", [85, 95]),
          work(0.5, 110, "Final burst!", [95, 105]),
          easy(5, 55, "Easy. Recover fully.", [85, 95]),
        ],
      },
      cool(6, 60, 45),
    ],
  },
  {
    slug: "long-tempo-pair-95",
    name: "Long Tempo Pair",
    sport: "BIKING",
    category: "tempo",
    level: "advanced",
    summary:
      "Two thirty-minute tempo blocks at 82% and 85% with a short break between.",
    description: paras(
      "Purpose: build serious muscular endurance with long, steady efforts.",
      "Physiology: thirty-minute blocks at 82-85% of FTP place heavy aerobic and moderate glycolytic demand, increasing fatigue resistance and the ability to sustain strong output for long periods.",
      "Execution: ride the first block at 82% and the second at 85%. Cadence 85-92 rpm, seated for most of it. Use the eight-minute break to eat and drink. ERG mode is useful for steady pacing; stand briefly for relief if needed.",
      "When in plan: build phase for event preparation. Scaling: drop both blocks to 80% if tired or shorten each to 25 minutes.",
    ),
    tags: ["indoor", "tempo", "long", "build"],
    items: [
      warm(15, 45, 68, undefined, [85, 95]),
      work(30, 82, "Block 1. Strong, steady tempo.", [85, 92]),
      easy(8, 55, "Easy. Fuel and reset.", [85, 95]),
      work(30, 85, "Block 2. Same discipline, a little firmer.", [85, 92]),
      cool(12, 60, 45),
    ],
  },
  {
    slug: "tempo-long-haul-120",
    name: "Tempo Long Haul",
    sport: "BIKING",
    category: "tempo",
    level: "advanced",
    summary:
      "A two-hour session with a 45-minute tempo block at 78% and a 35-minute block at 80%.",
    description: paras(
      "Purpose: build the ability to sit at a moderate tempo for a very long time, as in long events and breakaways.",
      "Physiology: long continuous work at 78-80% of FTP depletes glycogen steadily and trains fat and carbohydrate metabolism at high volume.",
      "Execution: ride the first block at 78% and the second at 80%, cadence 85-92 rpm. Fuel with 60-80 g of carbohydrate per hour. ERG mode is strongly recommended to prevent drift.",
      "When in plan: peak base or early build. Scaling: shorten each block by 10 minutes or reduce power by 3%.",
    ),
    tags: ["indoor", "tempo", "long", "build"],
    items: [
      warm(15, 45, 68, undefined, [85, 95]),
      work(45, 78, "Block 1. Steady tempo. Fuel early.", [85, 92]),
      easy(10, 55, "Easy. Eat and drink.", [85, 95]),
      work(35, 80, "Block 2. Stay patient.", [85, 92]),
      cool(15, 60, 45),
    ],
  },

  // ----------------------------------------------------------- cadence-skills
  {
    slug: "quick-spin-up-primer-20",
    name: "Quick Spin-Up Primer",
    sport: "BIKING",
    category: "cadence-skills",
    level: "beginner",
    summary:
      "A 20-minute introduction to fast, smooth pedalling with four one-minute spin-ups.",
    description: paras(
      "Purpose: learn to spin quickly and smoothly without bouncing, in a short session.",
      "Physiology: high cadence at light load trains neuromuscular coordination and lowers torque demand per pedal stroke, which can reduce muscular fatigue on longer rides.",
      "Execution: raise cadence gradually to 100-110 rpm and hold it for one minute while keeping hips still. Cue yourself to pedal circles, scraping mud off your shoe at the bottom. Recover at 85-90 rpm. If you bounce, reduce cadence by 5-10 rpm. Use ERG at low power or ride on resistance feel.",
      "When in plan: any easy day, or as a warm-up add-on to other sessions. Scaling: repeat the set twice for a 35-minute session.",
    ),
    tags: ["indoor", "short", "cadence", "skills", "beginner-friendly"],
    items: [
      warm(5, 45, 60, undefined, [85, 90]),
      {
        repeat: 4,
        steps: [
          work(1, 60, "Spin quickly and smoothly. Quiet hips.", [100, 110]),
          easy(2, 50, "Recover. Normal cadence.", [85, 90]),
        ],
      },
      cool(3, 52, 40),
    ],
  },
  {
    slug: "high-cadence-spin-ups-45",
    name: "High-Cadence Spin-Ups",
    sport: "BIKING",
    category: "cadence-skills",
    level: "intermediate",
    summary:
      "Six one-minute spin-ups at 105-115 rpm with a steady aerobic finish.",
    description: paras(
      "Purpose: improve leg speed, smoothness and efficiency at high cadence.",
      "Physiology: spinning at 100-115 rpm lowers the force per stroke while raising neural drive. Over time this improves coordination and your ability to ride efficiently at higher cadences.",
      "Execution: raise cadence over ten seconds to 105-115 rpm, hold for the minute with a quiet upper body, then settle at 85-90 rpm for three minutes. Finish with six minutes of steady riding at 65% and 95-100 rpm. Resistance should be low, so slope or resistance mode may suit this better than ERG.",
      "When in plan: once or twice a week in base, ideally before endurance rides. Scaling: reduce to four spin-ups or lower top cadence by 5 rpm.",
    ),
    tags: ["indoor", "cadence", "skills", "base"],
    items: [
      warm(10, 45, 62, undefined, [85, 90]),
      {
        repeat: 6,
        steps: [
          work(1, 62, "Spin up. Light and fast. No bouncing.", [105, 115]),
          easy(3, 55, "Settle at your normal cadence.", [85, 90]),
        ],
      },
      work(6, 65, "Steady and smooth at a slightly higher cadence.", [95, 100]),
      cool(5, 55, 40),
    ],
  },
  {
    slug: "one-leg-at-a-time-smoothness-45",
    name: "One Leg at a Time Smoothness",
    sport: "BIKING",
    category: "cadence-skills",
    level: "intermediate",
    summary:
      "Left-leg and right-leg focus intervals to smooth the pedal stroke across the whole circle.",
    description: paras(
      "Purpose: remove dead spots in the pedal stroke by thinking about each leg separately.",
      "Physiology: attending to the top and bottom of the stroke improves intermuscular coordination and the timing of muscle activation, which can improve efficiency and reduce fatigue.",
      "Execution: the app cannot enforce single-leg pedalling, so use these cues. During the left focus minute, imagine only the left leg is driving: push over the top, scrape the bottom, pull through the back and lift gently. Keep the right foot relaxed on the pedal but unloaded as far as is comfortable. Repeat for the right. Keep the load light; ERG mode is fine at this low power.",
      "When in plan: any easy or base day. Scaling: add a second set for a longer session or reduce to three rounds.",
    ),
    tags: ["indoor", "cadence", "skills", "single-leg", "drill"],
    items: [
      warm(10, 45, 60, undefined, [85, 90]),
      {
        repeat: 4,
        steps: [
          work(
            1,
            50,
            "Left leg focus. Push over the top, scrape through the bottom, pull through the back.",
            [70, 80],
          ),
          easy(1, 50, "Both legs. Smooth circles.", [85, 90]),
          work(
            1,
            50,
            "Right leg focus. Same cues. Keep the left foot relaxed.",
            [70, 80],
          ),
          easy(2, 55, "Both legs. Notice any change in feel.", [85, 90]),
        ],
      },
      work(10, 60, "Smooth full circles with both legs.", [90, 95]),
      cool(5, 52, 40),
    ],
  },
  {
    slug: "cadence-ladder-endurance-90",
    name: "Cadence Ladder Endurance",
    sport: "BIKING",
    category: "cadence-skills",
    level: "intermediate",
    summary:
      "A 90-minute endurance ride that steps cadence from 80 up to 105 rpm in each 15-minute cycle.",
    description: paras(
      "Purpose: build comfort across a wide range of cadences within normal endurance riding.",
      "Physiology: constant 66% power with changing cadence alters the balance between muscular force and cardiovascular effort. Lower cadence raises force per stroke; higher cadence raises heart rate and neural demand.",
      "Execution: hold 66% throughout. Each cycle is six minutes at 80-85 rpm, five at 90-95 and four at 100-105. Stay smooth at the top rung and avoid bouncing. ERG mode works because power is constant while you change gears or pedal speed.",
      "When in plan: base phase, once a week. Scaling: drop to three cycles for 75 minutes or widen the cadence range by 5 rpm on each side for more challenge.",
    ),
    tags: ["indoor", "cadence", "skills", "base", "endurance", "long"],
    items: [
      warm(15, 45, 62, undefined, [85, 90]),
      {
        repeat: 4,
        steps: [
          work(6, 66, "Lower rung: 80-85 rpm. Smooth and strong.", [80, 85]),
          work(5, 66, "Middle rung: 90-95 rpm.", [90, 95]),
          work(4, 66, "Upper rung: 100-105 rpm. Quiet hips.", [100, 105]),
        ],
      },
      cool(15, 60, 45),
    ],
  },
  {
    slug: "cadence-pyramid-60",
    name: "Cadence Pyramid",
    sport: "BIKING",
    category: "cadence-skills",
    level: "intermediate",
    summary:
      "Two seven-step pyramids that climb from 80 to 110 rpm and back down at steady power.",
    description: paras(
      "Purpose: expand your comfortable cadence range and practise controlled changes at constant power.",
      "Physiology: holding power constant while cadence changes shifts the muscular force requirement and heart rate response, training both neuromuscular coordination and cardiovascular efficiency.",
      "Execution: each step lasts three minutes. Use 66% for the first pyramid and 70% for the second. Move to the next cadence by changing gear if you can, keeping the effort steady. At the top, 110 rpm, stay smooth and relaxed. ERG mode works well; resistance may need to change as cadence changes.",
      "When in plan: base or build, once a week. Scaling: run a single pyramid for about 40 minutes or reduce the peak to 105 rpm.",
    ),
    tags: ["indoor", "cadence", "skills", "pyramid", "base"],
    items: [
      warm(8, 45, 65, undefined, [85, 90]),
      ...pyramid(3, 66),
      easy(5, 55, "Easy. Breathe and reset.", [85, 90]),
      ...pyramid(3, 70),
      cool(5, 55, 40),
    ],
  },
  {
    slug: "torque-and-spin-60",
    name: "Torque and Spin",
    sport: "BIKING",
    category: "cadence-skills",
    level: "advanced",
    summary:
      "Four six-minute seated low-cadence efforts at 76% followed by spin-out recoveries at 110 rpm.",
    description: paras(
      "Purpose: build force and smoothness at low cadence, then clear the legs with fast pedalling.",
      "Physiology: pedalling at 60-70 rpm at 76% of FTP raises muscular force per stroke, recruiting more muscle fibres, and the high-cadence recovery encourages quick relaxation and fluid circulation.",
      "Execution: stay seated for the low-cadence blocks, keep a stable core, and avoid pulling on the bars. Choose a gear that gets you to 60-70 rpm at the target power. Spin out at 105-115 rpm in the recovery. Stop the block if you feel knee pain. Use ERG mode with caution as low cadence can trigger power spikes; resistance mode may be smoother.",
      "When in plan: build or strength phases, once a week at most. Scaling: shorten blocks to four minutes or use 70-75 rpm if your knees are sensitive.",
    ),
    tags: ["indoor", "cadence", "skills", "low-cadence", "strength"],
    items: [
      warm(15, 45, 65, undefined, [85, 95]),
      {
        repeat: 4,
        steps: [
          work(6, 76, "Low cadence, seated. Strong, smooth torque.", [60, 70]),
          easy(3, 55, "Spin out light and fast.", [105, 115]),
        ],
      },
      cool(9, 55, 40),
    ],
  },
  {
    slug: "race-day-openers-30",
    name: "Race-Day Openers",
    sport: "BIKING",
    category: "cadence-skills",
    level: "intermediate",
    summary:
      "A short activation session with brief hard efforts to prime the legs before a race or key event.",
    description: paras(
      "Purpose: wake up the body the day before or the morning of a race without adding fatigue.",
      "Physiology: short efforts at high power briefly raise heart rate, muscle recruitment and neural drive, creating a primed state. Long recoveries mean there is little accumulated fatigue.",
      "Execution: ride the opening tempo easily, then three 30-second spin-up sprints at 120% with fast cadence, then two one-minute efforts at 105%. Recover fully between. Stay seated, relaxed and in control; these should leave you feeling sharp, not tired. ERG mode may lag on short efforts, so use slope or resistance mode if needed.",
      "When in plan: the day before a race or about an hour before the start. Scaling: reduce to two sprints and one longer effort if you feel tired.",
    ),
    tags: ["indoor", "short", "openers", "race-prep", "activation"],
    items: [
      warm(8, 45, 68, undefined, [85, 95]),
      work(2, 80, "Easy tempo to open the legs.", [90, 95]),
      easy(2, 50, "Easy spin.", [85, 90]),
      {
        repeat: 3,
        steps: [
          work(
            0.5,
            120,
            "Spin it up fast. Seated, relaxed shoulders.",
            [105, 115],
          ),
          easy(2.5, 50, "Full recovery.", [85, 90]),
        ],
      },
      {
        repeat: 2,
        steps: [
          work(1, 105, "Firm and controlled. Race-effort smooth.", [90, 100]),
          easy(2, 50, "Full recovery.", [85, 90]),
        ],
      },
      cool(3, 50, 40, "Easy spin. You are ready."),
    ],
  },

  // -------------------------------------------------------------------- test
  {
    slug: "step-ramp-test",
    name: "Step Ramp Test",
    sport: "BIKING",
    category: "test",
    level: "intermediate",
    summary:
      "A one-minute-step ramp that rises 6% every minute until you cannot hold the target.",
    description: paras(
      "Purpose: a short, convenient way to estimate FTP and track fitness over time. It needs only about 30 minutes and is less mentally demanding than a long steady test.",
      "How FTP is estimated: after warming up, power rises by about 6% of your current FTP every minute from 50%. Stop when you can no longer hold the target power at your chosen cadence. FTP is estimated as roughly 75% of your best full-minute average power. For example, a best minute of 320 W estimates an FTP near 240 W.",
      "Execution: do not use a high cadence to cheat; stay between 85 and 100 rpm. Keep hands light and breathing deep. Stay seated until the end. Use ERG mode so the trainer holds each step exactly. Stop when you cannot maintain the target for the minute, and use the cooldown. The test is only reliable if you start fresh, so take an easy day beforehand.",
      "Pacing and plan: retest every 4-8 weeks. Because the starting FTP sets the steps, a very wrong estimate can make the test too short or too long; the 21 steps reach 170%, which should cover most riders. Scaling: advanced riders with a low FTP estimate may reach the last step; if so, hold on and stop at 170%.",
    ),
    tags: ["indoor", "test", "ramp", "ftp", "short"],
    items: [
      warm(6, 40, 55, "Easy spin. Prepare to start the ramp.", [85, 95]),
      ...rampItems,
      cool(
        5,
        50,
        35,
        "Stop when you cannot hold the target. Spin easy and recover.",
      ),
    ],
  },
  {
    slug: "twenty-minute-ftp-test-66",
    name: "Twenty-Minute FTP Test",
    sport: "BIKING",
    category: "test",
    level: "advanced",
    summary:
      "A full warm-up, a five-minute blowout and then twenty minutes of the best even effort you can sustain.",
    description: paras(
      "Purpose: estimate FTP from your best sustainable 20-minute effort. It is harder to pace than a ramp test but rewards good pacing and reflects real long-effort power.",
      "How FTP is estimated: your average power for the 20-minute effort multiplied by 0.95 gives the FTP estimate. The five-minute blowout earlier in the session depletes fast-acting energy stores so the 20-minute effort measures steady power rather than a fresh anaerobic burst.",
      "Execution: warm up thoroughly, including the three one-minute fast spin-ups. Ride the five-minute blowout hard, but do not collapse; then ten minutes easy. For the 20-minute effort, start slightly conservative and aim for the highest power you can hold evenly. Settle into a rhythm in the first three minutes, hold steady through the middle, and empty yourself in the last five. Cadence 85-95 rpm. Turn ERG mode off for the test so you can choose your own power; the target shown is only a placeholder at 100% of your current FTP.",
      "When in plan: every 6-8 weeks, after an easy day or two. Avoid fast starts: if your first five minutes are far above your average, you will fade. Scaling: if you struggle with pacing, use the ramp test or the 8-minute test instead.",
    ),
    tags: ["indoor", "test", "ftp", "long"],
    items: [
      warm(10, 45, 70, "Gradual build. Loosen up.", [85, 95]),
      {
        repeat: 3,
        steps: [
          work(1, 90, "Fast spin-up. Quick legs.", [100, 110]),
          easy(1, 50, "Easy spin.", [85, 90]),
        ],
      },
      easy(5, 50, "Easy. Get ready.", [85, 90]),
      work(
        5,
        115,
        "Blowout. Hard but controlled; do not sprint the start.",
        [90, 100],
      ),
      easy(10, 50, "Spin easy. Recover fully before the test.", [85, 90]),
      work(
        20,
        100,
        "The test. Start conservatively; ride as hard as you can sustain, evenly. Turn ERG off and empty the tank in the last 5 minutes.",
        [85, 95],
      ),
      cool(10, 55, 40, "Spin easy and breathe. Well done."),
    ],
  },
  {
    slug: "double-eight-test-56",
    name: "Double Eight Test",
    sport: "BIKING",
    category: "test",
    level: "intermediate",
    summary:
      "Two eight-minute all-out efforts separated by ten minutes of recovery, used to estimate FTP.",
    description: paras(
      "Purpose: a shorter alternative to the 20-minute test that is easier to pace because each effort is brief and you get a second try.",
      "How FTP is estimated: take the higher of the two eight-minute averages and multiply by 0.90. Both efforts are ridden at a hard, evenly paced intensity; the second rarely beats the first by much, which gives a sanity check.",
      "Execution: warm up carefully, including the spin-ups. Start each eight-minute effort at a power you believe you can hold to the end, pace evenly and finish with everything you have in the last minute. Cadence 90-100 rpm. Recover completely during the ten-minute easy spin. Turn ERG mode off for the efforts; the target of 105% is only a placeholder.",
      "When in plan: every 6-8 weeks on a fresh day. Scaling: use alongside a ramp test to cross-check your numbers, and be cautious if the two eight-minute averages differ by more than about 5%.",
    ),
    tags: ["indoor", "test", "ftp", "8-minute"],
    items: [
      warm(10, 45, 70, "Gradual build. Loosen up.", [85, 95]),
      {
        repeat: 3,
        steps: [
          work(1, 90, "Fast spin-up. Quick legs.", [100, 110]),
          easy(1, 50, "Easy spin.", [85, 90]),
        ],
      },
      easy(4, 50, "Easy. Get ready.", [85, 90]),
      work(
        8,
        105,
        "Test 1. Pace evenly; empty the tank in the last minute. Turn ERG off.",
        [90, 100],
      ),
      easy(10, 50, "Easy spin. Recover fully.", [85, 90]),
      work(
        8,
        105,
        "Test 2. Same discipline; give everything in the last minute.",
        [90, 100],
      ),
      cool(10, 55, 40, "Spin easy. Good work."),
    ],
  },
];
