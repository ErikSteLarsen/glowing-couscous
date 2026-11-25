import { createEmptySessionEditorDraft, createSessionEditorBlockData, serializeSessionEditorDraft, type SessionEditorBlock } from '../session-editor.ts';
import { chartIntensityFraction, zoneForTarget } from '../workout-zone-intensity.ts';
import type { WorkoutTarget } from '../workout-targets.ts';
import { catalogStepZone, expandCatalogItems, type CatalogFlatStep } from './metrics.ts';
import type { CatalogStep, CatalogWorkout } from './types.ts';

export function catalogStepTarget(step: Pick<CatalogStep, 'lowPct' | 'highPct'>): WorkoutTarget {
  return { metric: 'power', mode: 'relative', reference: 'ftp', low: step.lowPct, high: step.highPct };
}

/** Rider-facing note for a block: the step cue, then the cadence cue, as sentences. */
export function catalogStepNote(step: Pick<CatalogFlatStep, 'cue' | 'cadence'>): string {
  const cadence = step.cadence ? (step.cadence[0] === step.cadence[1] ? `${step.cadence[0]} rpm` : `${step.cadence[0]}–${step.cadence[1]} rpm`) : null;
  const cue = step.cue && cadence && !/[.!?]$/.test(step.cue) ? `${step.cue}.` : step.cue;
  return [cue, cadence ? `Cadence ${cadence}` : null].filter(Boolean).join(' ');
}

/**
 * Canonical editor blocks for a catalog workout. Repeated sets are unrolled because a
 * block's `reps` repeats only that one block; the ride plan ramps warm-up and cool-down
 * ranges in the same direction the catalog intends.
 */
export function catalogWorkoutToEditorBlocks(workout: Pick<CatalogWorkout, 'slug' | 'sport' | 'items'>): SessionEditorBlock[] {
  return expandCatalogItems(workout.items).map((step) => {
    // Only bike workouts carry power targets; run and swim blocks are guided by zone.
    const target = workout.sport === 'BIKING' && step.kind !== 'pause' ? catalogStepTarget(step) : null;
    return {
      clientId: `catalog-${workout.slug}-${step.index}`,
      id: null,
      kind: step.kind,
      zone: target ? zoneForTarget(target, 'BIKING', null) ?? 1 : catalogStepZone(step),
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

/** Persistable copy of a public workout, for placements and saved training plans. */
export function catalogWorkoutToSourceEntry(workout: CatalogWorkout) {
  const input = catalogWorkoutToSessionInput(workout);
  const { blocks } = serializeSessionEditorDraft(createEmptySessionEditorDraft(input));
  return { sport: input.sport, title: input.title, summary: input.summary, sportMetricsJson: null, blocks: createSessionEditorBlockData(blocks) };
}

export function createCatalogWorkoutDraft(workout: CatalogWorkout) {
  return createEmptySessionEditorDraft({ ...catalogWorkoutToSessionInput(workout), title: `${workout.name} (my version)`, source: 'athlete-library' });
}

/** Segments in the shape `SessionBlockBar` draws, with intensity inside the zone for height and color. */
export function catalogBlockBarSegments(workout: Pick<CatalogWorkout, 'slug' | 'sport' | 'items'>) {
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
