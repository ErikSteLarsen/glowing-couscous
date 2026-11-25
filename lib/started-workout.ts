/**
 * A workout someone started without planning it. It has no date until its result is saved, so it
 * appears nowhere in the Calendar, the plan or My workouts: undated sessions with a plan are no
 * saved workouts, and dated reads skip undated ones.
 */
export const STARTED_WORKOUT_SOURCE = 'athlete-started';

export function isStartedWorkout(session: { source?: string | null }): boolean {
  return session.source === STARTED_WORKOUT_SOURCE;
}

/** Started, with nothing saved yet. */
export function isUnsavedStartedWorkout(session: { source?: string | null; date: Date | null }): boolean {
  return isStartedWorkout(session) && session.date === null;
}
