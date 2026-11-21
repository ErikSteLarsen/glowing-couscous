import { createEmptySessionEditorDraft, type SessionEditorBlock } from '../session-editor.ts';
import { chartIntensityFraction, zoneForTarget } from '../workout-zone-intensity.ts';
import type { WorkoutTarget } from '../workout-targets.ts';
import { expandCatalogItems, type CatalogFlatStep } from './metrics.ts';
import type { CatalogStep, CatalogWorkout } from './types.ts';

export function catalogStepTarget(step: Pick<CatalogStep, 'lowPct' | 'highPct'>): WorkoutTarget {
  return { metric: 'power', mode: 'relative', reference: 'ftp', low: step.lowPct, high: step.highPct };
}

/** Rider-facing note for a block: the step cue, then the cadence cue. */
export function catalogStepNote(step: Pick<CatalogFlatStep, 'cue' | 'cadence'>): string {
  const cadence = step.cadence ? (step.cadence[0] === step.cadence[1] ? `${step.cadence[0]} rpm` : `${step.cadence[0]}–${step.cadence[1]} rpm`) : null;
  return [step.cue, cadence ? `Cadence ${cadence}` : null].filter(Boolean).join(' · ');
}

/**
 * Canonical editor blocks for a catalog workout. Repeated sets are unrolled because a
 * block's `reps` repeats only that one block; the ride plan ramps warm-up and cool-down
 * ranges in the same direction the catalog intends.
 */
export function catalogWorkoutToEditorBlocks(workout: Pick<CatalogWorkout, 'slug' | 'items'>): SessionEditorBlock[] {
  return expandCatalogItems(workout.items).map((step) => {
    const target = catalogStepTarget(step);
    return {
      clientId: `catalog-${workout.slug}-${step.index}`,
      id: null,
      kind: step.kind,
      zone: zoneForTarget(target, 'BIKING', null) ?? 1,
      durationSec: step.durationSec,
      reps: null,
      target,
      note: catalogStepNote(step),
      skipped: false,
    };
  });
}

/** Summary plus the full description, so the copied session keeps the how-to-ride text. */
export function catalogSessionSummary(workout: Pick<CatalogWorkout, 'summary' | 'description'>): string {
  return [workout.summary.trim(), workout.description.trim()].filter(Boolean).join('\n\n');
}

/** A session-editor input (title, sport, summary, blocks) shared by Ride now, Schedule and Customize. */
export function catalogWorkoutToSessionInput(workout: CatalogWorkout) {
  return {
    sport: workout.sport,
    title: workout.name,
    summary: catalogSessionSummary(workout),
    blocks: catalogWorkoutToEditorBlocks(workout),
  };
}

export function createCatalogWorkoutDraft(workout: CatalogWorkout) {
  return createEmptySessionEditorDraft({ ...catalogWorkoutToSessionInput(workout), source: 'athlete-library' });
}

/** Segments in the shape `SessionBlockBar` draws, with intensity inside the zone for height and color. */
export function catalogBlockBarSegments(workout: Pick<CatalogWorkout, 'slug' | 'items'>) {
  return catalogWorkoutToEditorBlocks(workout).map((block, index) => ({
    key: `${block.clientId}-${index}`,
    zone: block.zone,
    durationSec: block.durationSec,
    label: block.kind,
    color: '',
    kind: block.kind,
    intensityFraction: block.target ? chartIntensityFraction(block.target, block.zone, 'BIKING', null) : 0.5,
  }));
}
