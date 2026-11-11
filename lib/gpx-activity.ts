import { isValid, parseISO } from 'date-fns';
import { SaxesParser } from 'saxes';
import { getTcxCalendarDay } from './tcx-time.ts';
import { MAX_ACTIVITY_IMPORT_BYTES } from './activity-import-limits.ts';

export type GpxSport = 'RUNNING' | 'BIKING' | 'SWIMMING';

export type ParsedGpxActivity = {
  sport: GpxSport;
  title: string;
  startedAt: Date;
  completedAt: Date;
  completedOn: string;
  sourceTimezoneOffsetMinutes: number;
  durationSec: number;
  distanceMeters: number | null;
};

export type GpxParseResult =
  | { ok: true; activity: ParsedGpxActivity }
  | { ok: false; error: string };

export const MAX_GPX_TRACK_POINTS = 50_000;

const GPX_NAMESPACE = 'http://www.topografix.com/GPX/1/1';
const EARTH_RADIUS_METERS = 6_371_008.8;
const MAX_PERSISTED_INTEGER = 2_147_483_647;
const sportLabels: Record<GpxSport, string> = {
  RUNNING: 'Running',
  BIKING: 'Cycling',
  SWIMMING: 'Swimming',
};

type TrackPoint = {
  latitude: number;
  longitude: number;
  time: Date;
  offsetMinutes: number;
};

type PendingTrackPoint = {
  latitude: number | null;
  longitude: number | null;
  time: string;
};

type TextCapture = {
  name: 'trackName' | 'time';
  depth: number;
  value: string;
};

class GpxParseError extends Error {}

function reject(message: string): never {
  throw new GpxParseError(message);
}

function readAttribute(tag: { attributes: Record<string, { name: string; value: string }> }, name: string) {
  return Object.values(tag.attributes).find((attribute) => attribute.name.toLowerCase() === name)?.value ?? null;
}

function parseTimezoneOffsetMinutes(value: string) {
  if (/z$/i.test(value)) return 0;
  const match = value.match(/([+-])(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes > 0)) return null;
  const offset = hours * 60 + minutes;
  return match[1] === '+' ? offset : -offset;
}

function parseTrackPointTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const time = parseISO(value);
  const offsetMinutes = parseTimezoneOffsetMinutes(value);
  if (!isValid(time) || offsetMinutes === null) return null;
  return { time, offsetMinutes };
}

function coordinate(value: string | null, minimum: number, maximum: number) {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function distanceBetween(first: TrackPoint, second: TrackPoint) {
  const radians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = radians(second.latitude - first.latitude);
  const longitudeDelta = radians(second.longitude - first.longitude);
  const firstLatitude = radians(first.latitude);
  const secondLatitude = radians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function parseSport(value: string): GpxSport | null {
  if (value === 'RUNNING' || value === 'BIKING' || value === 'SWIMMING') return value;
  return null;
}

/** Parses one GPX track into summary metrics. Coordinates and point data are discarded. */
export function parseGpxActivity(xml: string, requestedSport: string): GpxParseResult {
  if (Buffer.byteLength(xml, 'utf8') > MAX_ACTIVITY_IMPORT_BYTES) {
    return { ok: false, error: 'Activity files must be 5 MB or smaller.' };
  }
  const sport = parseSport(requestedSport);
  if (!sport) return { ok: false, error: 'Choose Running, Cycling, or Swimming for this GPX activity.' };

  try {
    const stack: string[] = [];
    const segments: TrackPoint[][] = [];
    let currentSegment: TrackPoint[] | null = null;
    let currentPoint: PendingTrackPoint | null = null;
    let capture: TextCapture | null = null;
    let trackCount = 0;
    let pointCount = 0;
    let elementCount = 0;
    let trackName = '';
    let rootNamespace: string | null = null;
    const parser = new SaxesParser({ xmlns: true });

    parser.on('doctype', () => reject('DOCTYPE is not allowed.'));
    parser.on('opentag', (tag) => {
      elementCount += 1;
      if (elementCount > 200_000) reject('GPX contains too many XML elements.');
      const name = tag.local.toLowerCase();
      stack.push(name);

      if (stack.length === 1) {
        if (name !== 'gpx') reject('Choose a GPX 1.1 activity file.');
        const version = readAttribute(tag, 'version');
        if (version !== null && version !== '1.1') reject('Only GPX 1.1 activity files are supported.');
        if (tag.uri !== '' && tag.uri !== GPX_NAMESPACE) reject('Choose a GPX 1.1 activity file.');
        rootNamespace = tag.uri;
      }

      const inGpxRoot = stack[0] === 'gpx' && rootNamespace !== null && tag.uri === rootNamespace;
      if (inGpxRoot && stack.length === 2 && name === 'trk') {
        trackCount += 1;
        if (trackCount > 1) reject('Import one GPS track per GPX file.');
      } else if (inGpxRoot && stack.length === 3 && stack[1] === 'trk' && name === 'name') {
        capture = { name: 'trackName', depth: stack.length, value: '' };
      } else if (inGpxRoot && stack.length === 3 && stack[1] === 'trk' && name === 'trkseg') {
        currentSegment = [];
        segments.push(currentSegment);
      } else if (inGpxRoot && stack.length === 4 && stack[1] === 'trk' && stack[2] === 'trkseg' && name === 'trkpt') {
        pointCount += 1;
        if (pointCount > MAX_GPX_TRACK_POINTS) reject(`GPX tracks may contain at most ${MAX_GPX_TRACK_POINTS.toLocaleString('en-US')} trackpoints.`);
        currentPoint = {
          latitude: coordinate(readAttribute(tag, 'lat'), -90, 90),
          longitude: coordinate(readAttribute(tag, 'lon'), -180, 180),
          time: '',
        };
      } else if (inGpxRoot && stack.length === 5 && stack[1] === 'trk' && stack[2] === 'trkseg' && stack[3] === 'trkpt' && name === 'time' && currentPoint) {
        if (currentPoint.time || capture?.name === 'time') reject('Each GPX trackpoint must have one recorded time.');
        capture = { name: 'time', depth: stack.length, value: '' };
      }
    });
    parser.on('text', (value) => {
      if (capture) capture.value += value;
    });
    parser.on('cdata', (value) => {
      if (capture) capture.value += value;
    });
    parser.on('closetag', (tag) => {
      const name = tag.local.toLowerCase();
      const captureMatchesTag = capture?.name === 'trackName' ? name === 'name' : name === 'time';
      if (capture && capture.depth === stack.length && captureMatchesTag) {
        if (capture.name === 'trackName') trackName = capture.value.trim();
        else if (currentPoint) currentPoint.time = capture.value.trim();
        capture = null;
      }

      if (name === 'trkpt' && stack.length === 4) {
        if (!currentPoint) reject('GPX trackpoint data is incomplete.');
        const latitude = currentPoint.latitude;
        const longitude = currentPoint.longitude;
        if (latitude === null || longitude === null) {
          reject('Every GPX trackpoint must have valid latitude and longitude coordinates.');
        }
        if (!currentPoint.time) reject('Every GPX trackpoint must include a recorded time.');
        const parsedTime = parseTrackPointTime(currentPoint.time);
        if (!parsedTime) reject('Every GPX trackpoint time must be valid and include a UTC offset.');
        if (!currentSegment) reject('GPX trackpoints must be inside a track segment.');
        currentSegment.push({ latitude, longitude, time: parsedTime.time, offsetMinutes: parsedTime.offsetMinutes });
        currentPoint = null;
      } else if (name === 'trkseg' && stack.length === 3) {
        currentSegment = null;
      }
      stack.pop();
    });

    parser.write(xml).close();
    if (trackCount === 0) return { ok: false, error: 'No GPS track was found. Route-only GPX files cannot be imported as completed activities.' };
    const points = segments.flat();
    if (points.length < 2) return { ok: false, error: 'The GPX activity must contain at least two timed trackpoints.' };

    const sourceTimezoneOffsetMinutes = points[0]?.offsetMinutes;
    if (sourceTimezoneOffsetMinutes === undefined || points.some((point) => point.offsetMinutes !== sourceTimezoneOffsetMinutes)) {
      return { ok: false, error: 'GPX trackpoints must use one consistent UTC offset so the recorded local day can be preserved.' };
    }
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      if (previous && current && current.time.getTime() <= previous.time.getTime()) {
        return { ok: false, error: 'GPX trackpoint times must be in increasing order.' };
      }
    }

    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) return { ok: false, error: 'The GPX activity must contain at least two timed trackpoints.' };
    const durationSec = Math.round((last.time.getTime() - first.time.getTime()) / 1000);
    if (!Number.isSafeInteger(durationSec) || durationSec < 1) {
      return { ok: false, error: 'The GPX track does not contain a measurable activity duration.' };
    }
    if (durationSec > MAX_PERSISTED_INTEGER) {
      return { ok: false, error: 'The GPX activity duration exceeds the supported range.' };
    }

    let distance = 0;
    for (const segment of segments) {
      for (let index = 1; index < segment.length; index += 1) {
        const previous = segment[index - 1];
        const current = segment[index];
        if (previous && current) distance += distanceBetween(previous, current);
      }
    }
    const roundedDistance = Math.round(distance);
    if (!Number.isSafeInteger(roundedDistance) || roundedDistance > MAX_PERSISTED_INTEGER) {
      return { ok: false, error: 'The GPX track distance exceeds the supported range.' };
    }

    return {
      ok: true,
      activity: {
        sport,
        title: trackName.slice(0, 120) || `${sportLabels[sport]} activity`,
        startedAt: first.time,
        completedAt: last.time,
        completedOn: getTcxCalendarDay(last.time, sourceTimezoneOffsetMinutes),
        sourceTimezoneOffsetMinutes,
        durationSec,
        distanceMeters: roundedDistance > 0 ? roundedDistance : null,
      },
    };
  } catch (error) {
    if (error instanceof GpxParseError) return { ok: false, error: error.message };
    return { ok: false, error: 'This file is not a valid supported GPX activity.' };
  }
}
