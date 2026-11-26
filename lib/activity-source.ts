/**
 * Where an activity came from, for My activities: recorded in TempoBuilder
 * (Ride or the guided player), imported (a file or Strava), or entered by hand
 * (logged, or a planned workout marked done).
 */
export const ACTIVITY_SOURCE_GROUPS = [
  { id: 'recorded', label: 'Recorded here' },
  { id: 'imported', label: 'Imported' },
  { id: 'manual', label: 'Logged by hand' },
] as const;

export type ActivitySourceGroup = (typeof ACTIVITY_SOURCE_GROUPS)[number]['id'];

export const IMPORTED_METRICS_SOURCES = ['file-import', 'strava-import', 'tcx-import', 'fit-import', 'gpx-import'] as const;

export function parseActivitySourceGroup(value: unknown): ActivitySourceGroup | null {
  return ACTIVITY_SOURCE_GROUPS.find((group) => group.id === value)?.id ?? null;
}

const FILE_LABELS: Record<string, string> = {
  'fit-import': 'FIT file',
  'gpx-import': 'GPX file',
  'tcx-import': 'TCX file',
  'file-import': 'Activity file',
};

export type ActivitySource = {
  group: ActivitySourceGroup;
  /** The exact way in, for its icon. */
  kind: 'ride' | 'live' | 'strava' | 'file' | 'logged' | 'done';
  label: string;
};

export function describeActivitySource(activity: { metricsSource: string; recordedWith: string | null; externalSource: string | null }): ActivitySource {
  if (activity.recordedWith === 'ride') return { group: 'recorded', kind: 'ride', label: 'Recorded with Ride' };
  if (activity.recordedWith === 'live') return { group: 'recorded', kind: 'live', label: 'Followed in TempoBuilder' };
  if (activity.metricsSource === 'strava-import' || activity.externalSource === 'STRAVA') return { group: 'imported', kind: 'strava', label: 'From Strava' };
  if (Object.hasOwn(FILE_LABELS, activity.metricsSource)) return { group: 'imported', kind: 'file', label: FILE_LABELS[activity.metricsSource] };
  if (activity.metricsSource === 'manual-unplanned' || activity.metricsSource === 'manual-paired') return { group: 'manual', kind: 'logged', label: 'Logged by hand' };
  return { group: 'manual', kind: 'done', label: 'Marked done' };
}
