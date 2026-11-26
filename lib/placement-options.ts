import { accountService } from './account-service.ts';
import { summarizeOwnedWorkout } from './owned-workout-summary.ts';
import { builtInPlanPreviews } from './plan-catalog/index.ts';
import type { PlanSlot } from './plan-catalog/selection.ts';
import { derivePlannerSourceDurationSec } from './planner-source-metrics.ts';
import { getTempoZoneMeta, type TempoZone } from './tempo-blocks.ts';
import { templateService } from './template-service.ts';
import { getTemplateCadence } from './template-cadence.ts';
import { parseTemplateRoutine } from './template-routine.ts';
import { workoutCatalog } from './workout-catalog/index.ts';
import { expandCatalogItems } from './workout-catalog/metrics.ts';
import { categoryLabel, createCatalogListEntries, levelLabel } from './workout-catalog/query.ts';
import { workoutLibraryService } from './workout-library-service.ts';

/** One step of a workout's intensity shape, in %FTP or zone-equivalent height. */
export type AddableProfileStep = { startSec: number; durationSec: number; startPct: number; endPct: number; kind: string };

/** A workout the Add workout dialog can place: a saved one, or one from the public library. */
export type AddableWorkout = {
  /** `workout:<id>` or `catalog:<slug>`, the same keys as `source=`. */
  key: string;
  origin: 'mine' | 'library';
  title: string;
  sport: string;
  summary: string | null;
  /** Library focus (Recovery, Threshold…) or a saved workout's hardest zone. */
  focus: string | null;
  focusId: string | null;
  level: string | null;
  durationSec: number;
  tss: number | null;
  intensityFactor: number | null;
  profile: AddableProfileStep[];
};

/** A weekly plan the Add training plan dialog can place: one of yours, or a built-in week. */
export type AddablePlan = {
  /** `template:<id>` or `built-in-plan:<slug>`. */
  key: string;
  origin: 'mine' | 'built-in';
  name: string;
  summary: string | null;
  /** Built-in plans are versioned; the server rejects a stale version. */
  version: number | null;
  /** Weeks offered first; a plan saved as monthly starts at four. */
  defaultWeeks: number;
  /** One week of workouts by weekday. Built-in slots can offer alternatives. */
  slots: PlanSlot[];
};

const catalogOptions: AddableWorkout[] = createCatalogListEntries(workoutCatalog).map(({ workout, metrics }) => ({
  key: `catalog:${workout.slug}`,
  origin: 'library',
  title: workout.name,
  sport: workout.sport,
  summary: workout.summary,
  focus: categoryLabel(workout.category),
  focusId: workout.category,
  level: levelLabel(workout.level),
  durationSec: metrics.durationSec,
  tss: metrics.tss,
  intensityFactor: workout.sport === 'BIKING' ? metrics.intensityFactor : null,
  profile: expandCatalogItems(workout.items).map(({ startSec, durationSec, startPct, endPct, kind }) => ({ startSec, durationSec, startPct, endPct, kind })),
}));

/** Everything Add workout offers: saved workouts (most recently changed first), then the whole public library. */
export async function loadAddableWorkouts(userId: number) {
  const [workouts, account] = await Promise.all([
    workoutLibraryService.listForOwner('athlete', userId),
    accountService.getAccount(userId),
  ]);
  const profile = account?.performanceProfile ?? null;
  const mine = [...workouts]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((workout): AddableWorkout => {
      const summary = summarizeOwnedWorkout(workout, profile);
      return {
        key: `workout:${workout.id}`,
        origin: 'mine',
        title: workout.title,
        sport: workout.sport,
        summary: summary.lead ?? workout.summary,
        focus: summary.peakZone ? getTempoZoneMeta(summary.peakZone as TempoZone).name : null,
        focusId: null,
        level: null,
        durationSec: summary.durationSec,
        tss: summary.tss,
        intensityFactor: summary.intensityFactor,
        profile: summary.profile.steps.map(({ startSec, durationSec, startPct, endPct, kind }) => ({ startSec, durationSec, startPct, endPct, kind })),
      };
    });
  return [...mine, ...catalogOptions];
}

/** Everything Add training plan offers: your plans first, then the built-in weeks. */
export async function loadAddablePlans(userId: number): Promise<AddablePlan[]> {
  const templates = await templateService.listForOwner(userId);
  const mine = templates.flatMap((template): AddablePlan[] => {
    const routine = parseTemplateRoutine(template.routineJson);
    if (!routine) return [];
    return [{
      key: `template:${template.id}`,
      origin: 'mine',
      name: template.name,
      summary: template.summary,
      version: null,
      defaultWeeks: getTemplateCadence(template.cadence) === 'month' ? 4 : 1,
      slots: routine.entries.map((entry, index) => ({
        id: `entry-${index}`,
        weekday: entry.weekday,
        label: entry.title,
        options: [{ id: `entry-${index}`, title: entry.title, sport: entry.sport, durationSec: derivePlannerSourceDurationSec(entry.blocks) }],
      })),
    }];
  });
  const builtIn = builtInPlanPreviews.map((plan): AddablePlan => ({
    key: `built-in-plan:${plan.slug}`,
    origin: 'built-in',
    name: plan.name,
    summary: plan.summary,
    version: plan.version,
    defaultWeeks: 1,
    slots: plan.slots,
  }));
  return [...mine, ...builtIn];
}
