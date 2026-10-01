import { createHash } from 'node:crypto';
import { ACTIVITY_ANALYZER_VERSION } from './activity-analysis.ts';

export function activityAnalysisInputHash(telemetryJson: string, durationSec: number, profileJson: string) {
  return createHash('sha256').update(JSON.stringify([ACTIVITY_ANALYZER_VERSION, telemetryJson, durationSec, profileJson])).digest('hex');
}
export function newActivityAnalysisJob(telemetryJson: string, durationSec: number, profileJson: string) {
  return { inputHash: activityAnalysisInputHash(telemetryJson, durationSec, profileJson), profileJson, version: ACTIVITY_ANALYZER_VERSION };
}
/** Explicit allowlist: nothing sourced through the Strava API reaches this pipeline. */
export function isActivityAnalysisEligible(activity: { metricsSource: string; externalSource: string | null; session: { sport: string } }) {
  return activity.metricsSource === 'file-import' && activity.externalSource === null && activity.session.sport === 'RUNNING';
}
