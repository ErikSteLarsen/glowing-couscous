import { isCatalogRepeat } from './metrics.ts';
import { isCatalogCategory, isCatalogLevel } from './query.ts';
import type { CatalogStep, CatalogWorkout } from './types.ts';

const STEP_KINDS = new Set(['warmup', 'work', 'recovery', 'cooldown']);
export const CATALOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CATALOG_MIN_PCT = 30;
export const CATALOG_MAX_PCT = 300;

function validateStep(step: CatalogStep, where: string): string[] {
  const errors: string[] = [];
  if (!STEP_KINDS.has(step.kind)) errors.push(`${where}: unknown step kind "${String(step.kind)}".`);
  if (!Number.isInteger(step.durationSec) || step.durationSec <= 0) errors.push(`${where}: duration must be a positive whole number of seconds.`);
  for (const [name, value] of [['lowPct', step.lowPct], ['highPct', step.highPct]] as const) {
    if (!Number.isInteger(value) || value < CATALOG_MIN_PCT || value > CATALOG_MAX_PCT) errors.push(`${where}: ${name} must be a whole %FTP from ${CATALOG_MIN_PCT} to ${CATALOG_MAX_PCT}.`);
  }
  if (step.lowPct > step.highPct) errors.push(`${where}: lowPct must not exceed highPct (ramp direction comes from the step kind).`);
  if (step.cadence !== undefined) {
    const [low, high] = Array.isArray(step.cadence) ? step.cadence : [NaN, NaN];
    if (!Number.isInteger(low) || !Number.isInteger(high) || low < 30 || high > 200 || low > high) errors.push(`${where}: cadence must be [low, high] rpm between 30 and 200.`);
  }
  if (step.cue !== undefined && (typeof step.cue !== 'string' || !step.cue.trim())) errors.push(`${where}: cue must be non-empty text when present.`);
  return errors;
}

/** Schema-contract checks for one catalog workout. Returns human-readable problems, empty when valid. */
export function validateCatalogWorkout(workout: CatalogWorkout): string[] {
  const label = workout.slug || workout.name || '(unnamed)';
  const errors: string[] = [];
  if (!CATALOG_SLUG_PATTERN.test(workout.slug)) errors.push(`${label}: slug must be kebab-case.`);
  if (!workout.name?.trim()) errors.push(`${label}: name is required.`);
  if (workout.sport !== 'BIKING') errors.push(`${label}: sport must be BIKING.`);
  if (!isCatalogCategory(workout.category)) errors.push(`${label}: unknown category "${String(workout.category)}".`);
  if (!isCatalogLevel(workout.level)) errors.push(`${label}: unknown level "${String(workout.level)}".`);
  if (!workout.summary?.trim()) errors.push(`${label}: summary is required.`);
  if (!workout.description?.trim()) errors.push(`${label}: description is required.`);
  if (!Array.isArray(workout.tags) || workout.tags.some((tag) => typeof tag !== 'string' || !tag.trim())) errors.push(`${label}: tags must be non-empty strings.`);
  if (!Array.isArray(workout.items) || workout.items.length === 0) errors.push(`${label}: at least one item is required.`);
  (workout.items ?? []).forEach((item, itemIndex) => {
    const where = `${label} item ${itemIndex + 1}`;
    if (isCatalogRepeat(item)) {
      if (!Number.isInteger(item.repeat) || item.repeat < 1) errors.push(`${where}: repeat must be a positive whole number.`);
      if (!Array.isArray(item.steps) || item.steps.length === 0) errors.push(`${where}: a repeated set needs steps.`);
      (item.steps ?? []).forEach((step, stepIndex) => errors.push(...validateStep(step, `${where} step ${stepIndex + 1}`)));
    } else {
      errors.push(...validateStep(item, where));
    }
  });
  return errors;
}

export function validateCatalog(workouts: readonly CatalogWorkout[]): string[] {
  const errors = workouts.flatMap(validateCatalogWorkout);
  const seen = new Set<string>();
  for (const workout of workouts) {
    if (seen.has(workout.slug)) errors.push(`${workout.slug}: slug is used more than once.`);
    seen.add(workout.slug);
  }
  return errors;
}
