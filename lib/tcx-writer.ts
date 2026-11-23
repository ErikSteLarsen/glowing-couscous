import type { ActivityLap } from './activity-laps.ts';
import type { ActivitySeriesPoint } from './activity-series.ts';

/** A saved activity's recorded data, ready to write as a Garmin TCX v2 file. */
export type TcxWriterInput = {
  sport: string;
  title: string;
  startedAt: Date;
  durationSec: number;
  distanceMeters: number | null;
  points: ActivitySeriesPoint[];
  laps?: ActivityLap[];
};

const TCX_SPORT: Record<string, 'Biking' | 'Running' | 'Other'> = { BIKING: 'Biking', RUNNING: 'Running' };

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character);
}

function isoSecond(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function num(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
}

/** Splits samples into the recorded laps, or one lap over the whole activity. */
function lapSpans(input: TcxWriterInput) {
  const laps = (input.laps ?? []).filter((lap) => lap.endSec > lap.startSec && lap.startSec < input.durationSec);
  if (laps.length === 0) return [{ startSec: 0, endSec: input.durationSec }];
  return laps.map((lap, index) => ({
    startSec: index === 0 ? 0 : lap.startSec,
    endSec: index === laps.length - 1 ? Math.max(lap.endSec, input.durationSec) : lap.endSec,
  }));
}

function trackpoint(point: ActivitySeriesPoint, startedAtMs: number) {
  const parts = [`<Time>${isoSecond(new Date(startedAtMs + point.elapsedSec * 1000))}</Time>`];
  if (num(point.elevationMeters)) parts.push(`<AltitudeMeters>${round(point.elevationMeters, 1)}</AltitudeMeters>`);
  if (num(point.distanceMeters)) parts.push(`<DistanceMeters>${round(point.distanceMeters, 1)}</DistanceMeters>`);
  if (num(point.heartRateBpm)) parts.push(`<HeartRateBpm><Value>${round(point.heartRateBpm)}</Value></HeartRateBpm>`);
  if (num(point.cadenceRpm)) parts.push(`<Cadence>${Math.min(254, Math.round(point.cadenceRpm))}</Cadence>`);
  const extensions: string[] = [];
  if (num(point.speedMetersPerSecond)) extensions.push(`<Speed>${round(point.speedMetersPerSecond, 2)}</Speed>`);
  if (num(point.powerWatts)) extensions.push(`<Watts>${round(point.powerWatts)}</Watts>`);
  if (extensions.length) parts.push(`<Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">${extensions.join('')}</TPX></Extensions>`);
  return `<Trackpoint>${parts.join('')}</Trackpoint>`;
}

/**
 * Writes the activity as TCX: one Activity, its laps, and one Trackpoint per recorded sample.
 * Times are UTC; Strava and other importers read power and speed from the TPX extension.
 */
export function buildActivityTcx(input: TcxWriterInput): string {
  const startedAtMs = input.startedAt.getTime();
  const sport = TCX_SPORT[input.sport] ?? 'Other';
  const points = [...input.points].sort((left, right) => left.elapsedSec - right.elapsedSec);
  const spans = lapSpans(input);
  let distanceSoFar = 0;
  const laps = spans.map((span, index) => {
    const last = index === spans.length - 1;
    const lapPoints = points.filter((point) => point.elapsedSec >= span.startSec && (last ? point.elapsedSec <= span.endSec : point.elapsedSec < span.endSec));
    const heartRates = lapPoints.flatMap((point) => num(point.heartRateBpm) ? [point.heartRateBpm] : []);
    const distances = lapPoints.flatMap((point) => num(point.distanceMeters) ? [point.distanceMeters] : []);
    // Each lap covers the distance since the end of the previous lap.
    const lapDistance = distances.length ? Math.max(0, distances[distances.length - 1] - distanceSoFar) : null;
    if (distances.length) distanceSoFar = Math.max(distanceSoFar, distances[distances.length - 1]);
    const body = [
      `<TotalTimeSeconds>${span.endSec - span.startSec}</TotalTimeSeconds>`,
      `<DistanceMeters>${round(lapDistance ?? (spans.length === 1 ? input.distanceMeters ?? 0 : 0), 1)}</DistanceMeters>`,
      '<Calories>0</Calories>',
      heartRates.length ? `<AverageHeartRateBpm><Value>${Math.round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length)}</Value></AverageHeartRateBpm>` : '',
      heartRates.length ? `<MaximumHeartRateBpm><Value>${Math.round(Math.max(...heartRates))}</Value></MaximumHeartRateBpm>` : '',
      '<Intensity>Active</Intensity>',
      '<TriggerMethod>Manual</TriggerMethod>',
      `<Track>${lapPoints.map((point) => trackpoint(point, startedAtMs)).join('')}</Track>`,
    ].join('');
    return `<Lap StartTime="${isoSecond(new Date(startedAtMs + span.startSec * 1000))}">${body}</Lap>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">',
    `<Activities><Activity Sport="${sport}"><Id>${isoSecond(input.startedAt)}</Id>${laps.join('')}`,
    `<Notes>${escapeXml(input.title)}</Notes>`,
    '<Creator xsi:type="Device_t"><Name>Tempo</Name><UnitId>0</UnitId><ProductID>0</ProductID><Version><VersionMajor>1</VersionMajor><VersionMinor>0</VersionMinor></Version></Creator>',
    '</Activity></Activities>',
    '<Author xsi:type="Application_t"><Name>Tempo</Name><Build><Version><VersionMajor>1</VersionMajor><VersionMinor>0</VersionMinor></Version></Build><LangID>en</LangID><PartNumber>000-00000-00</PartNumber></Author>',
    '</TrainingCenterDatabase>',
    '',
  ].join('\n');
}

export function activityTcxFilename(title: string, startedAt: Date) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'activity';
  return `${startedAt.toISOString().slice(0, 10)}-${slug}.tcx`;
}
