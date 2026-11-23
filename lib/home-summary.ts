import { format } from 'date-fns';

export type HomeActivity = {
  id: number;
  sessionId: number;
  completedAt: Date;
  durationSec: number;
  /** Null when no defensible TSS was recorded; never a measured zero. */
  tss: number | null;
  metricsSource: string;
  zoneDistributionJson?: string | null;
  importTitle?: string | null;
  session: { title: string };
};

export type HomeTotals = {
  count: number;
  durationSec: number;
  tss: number | null;
  loadUnavailableCount: number;
};

// Imports with no calibrated HR samples store 0 as a legacy sentinel. A real
// rounded zero remains valid when the saved zone distribution contains time.
export function homeActivityLoadAvailable(activity: Pick<HomeActivity, 'tss' | 'metricsSource' | 'zoneDistributionJson'>) {
  if (activity.tss === null) return false;
  if (!['file-import', 'strava-import'].includes(activity.metricsSource) || activity.tss !== 0) return true;
  try {
    const zones: unknown = JSON.parse(activity.zoneDistributionJson ?? 'null');
    return Array.isArray(zones) && zones.length === 5 && zones.every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
      && zones.some((value) => value > 0);
  } catch {
    return false;
  }
}

export function summarizeHomeActivities(activities: HomeActivity[]): HomeTotals {
  const uniqueActivities = [...new Map(activities.map((activity) => [activity.id, activity])).values()];
  const available = uniqueActivities.filter(homeActivityLoadAvailable);
  return {
    count: uniqueActivities.length,
    durationSec: uniqueActivities.reduce((sum, activity) => sum + activity.durationSec, 0),
    tss: uniqueActivities.length > 0 && available.length === 0 ? null : available.reduce((sum, activity) => sum + (activity.tss ?? 0), 0),
    loadUnavailableCount: uniqueActivities.length - available.length,
  };
}

export function homeActivityReadout(activity: HomeActivity) {
  return {
    id: activity.id,
    sessionId: activity.sessionId,
    title: activity.importTitle || activity.session.title,
    completedAt: activity.completedAt,
    label: format(activity.completedAt, 'd\u00A0MMM'),
    dateLabel: format(activity.completedAt, 'd\u00A0MMM\u00A0yyyy'),
    durationSec: activity.durationSec,
    tss: activity.tss,
    loadAvailable: homeActivityLoadAvailable(activity),
    sourceLabel: activity.metricsSource === 'strava-import' ? 'Strava' : activity.metricsSource === 'file-import' ? 'Activity file' : 'Logged by hand',
  };
}

export function homeLoadLabel(totals: Pick<HomeTotals, 'tss' | 'loadUnavailableCount'>) {
  if (totals.tss === null) return 'No TSS';
  return `${totals.tss} estimated TSS${totals.loadUnavailableCount > 0 ? ', some TSS missing' : ''}`;
}

export function homeLoadBarPercent(point: { tss: number | null; loadAvailable: boolean }, points: Array<{ tss: number | null; loadAvailable: boolean }>) {
  const max = Math.max(0, ...points.filter((entry) => entry.loadAvailable).map((entry) => entry.tss ?? 0));
  return point.loadAvailable && point.tss !== null && max > 0 ? (point.tss / max) * 100 : 0;
}
