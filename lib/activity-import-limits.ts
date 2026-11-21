export const MAX_ACTIVITY_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_ACTIVITY_IMPORT_DURATION_SEC = 36 * 60 * 60;
export const MAX_ACTIVITY_IMPORT_POINTS = 20_000;
export const MAX_ACTIVITY_IMPORT_DISTANCE_METERS = 2_000_000;
/** Longest wall-clock span from start to finish, leaving room for pauses within the timer limit. */
export const MAX_ACTIVITY_IMPORT_SPAN_SEC = 48 * 60 * 60;
/** Clock slack allowed when a recorded finish lands just before start plus timer duration. */
export const ACTIVITY_IMPORT_FINISH_TOLERANCE_SEC = 2;
