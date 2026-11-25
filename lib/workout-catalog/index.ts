import type { CatalogWorkout } from './types.ts';
import { foundationWorkouts } from './workouts/foundation.ts';
import { thresholdWorkouts } from './workouts/threshold.ts';
import { intensityWorkouts } from './workouts/intensity.ts';
import { triathlonWorkouts } from './workouts/triathlon.ts';

export type { CatalogWorkout } from './types.ts';

export const workoutCatalog: readonly CatalogWorkout[] = [...foundationWorkouts, ...thresholdWorkouts, ...intensityWorkouts, ...triathlonWorkouts];
