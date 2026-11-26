import type { ActivitySeriesPoint } from './activity-series.ts';
import type { ActivityLap } from './activity-laps.ts';

export type ImportedActivityFile = {
  title: string;
  sport: string;
  startedAt: string;
  durationSec: number;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  points: ActivitySeriesPoint[];
  laps?: ActivityLap[];
};

type RawPoint = ActivitySeriesPoint & { timestampMs: number };
type RawLap = { startMs: number; endMs: number; timerSec: number | null };
type FitField = { number: number; size: number; baseType: number };
type FitDefinition = { globalMessage: number; bigEndian: boolean; fields: FitField[] };

const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);
const MAX_ACTIVITY_DURATION_SEC = 36 * 60 * 60;
const MAX_ACTIVITY_POINTS = 20000;
const MAX_ACTIVITY_FILE_BYTES = 20 * 1024 * 1024;

export function parseActivityFile(filename: string, input: ArrayBuffer | string): ImportedActivityFile {
  const inputBytes = typeof input === 'string' ? new TextEncoder().encode(input).byteLength : input.byteLength;
  if (inputBytes > MAX_ACTIVITY_FILE_BYTES) throw new Error('Files must be 20 MB or smaller.');
  const extension = filename.split('.').at(-1)?.toLowerCase();
  const parsed = extension === 'fit'
    ? parseFit(input instanceof ArrayBuffer ? new DataView(input) : invalidFile())
    : extension === 'tcx'
      ? parseTcx(input instanceof ArrayBuffer ? new TextDecoder().decode(input) : input)
      : extension === 'gpx'
        ? parseGpx(input instanceof ArrayBuffer ? new TextDecoder().decode(input) : input)
        : invalidFile();

  if (parsed.points.length === 0) {
    throw new Error('This file has no recorded data.');
  }
  if (parsed.points.length > MAX_ACTIVITY_POINTS) {
    throw new Error('This activity has too much recorded data to import.');
  }

  const ordered = parsed.points
    .filter((point) => Number.isFinite(point.timestampMs))
    .sort((left, right) => left.timestampMs - right.timestampMs);
  const startedAtMs = Date.parse(parsed.startedAt ?? '') || ordered[0].timestampMs;
  const points = normalizePoints(ordered, startedAtMs);
  const lastElapsed = points.at(-1)?.elapsedSec ?? 0;
  const durationSec = boundedDuration(parsed.durationSec ?? lastElapsed, lastElapsed);
  const distanceMeters = positiveOrNull(parsed.distanceMeters ?? points.at(-1)?.distanceMeters ?? null);
  const fileTitle = cleanText(filename.split(/[\\/]/).at(-1)?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') ?? '');
  const title = cleanText(parsed.title) || fileTitle || `${displaySport(parsed.sport)} activity`;
  const sport = normalizeSport(parsed.sport);

  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) {
    throw new Error('This activity has no valid start time.');
  }

  return {
    title,
    sport,
    startedAt: new Date(startedAtMs).toISOString(),
    durationSec,
    distanceMeters,
    elevationGainMeters: positiveOrNull(parsed.elevationGainMeters),
    points,
    laps: ('laps' in parsed ? parsed.laps as RawLap[] : []).flatMap((lap) => {
      const startSec = Math.round((lap.startMs - startedAtMs) / 1000);
      const endSec = Math.round((lap.endMs - startedAtMs) / 1000);
      return startSec >= 0 && endSec > startSec && endSec <= durationSec
        ? [{ startSec, endSec, timerSec: lap.timerSec, origin: 'device' as const }] : [];
    }).sort((a, b) => a.startSec - b.startSec),
  };
}

function parseTcx(xml: string) {
  const activity = findElement(xml, 'Activity');
  const sport = getAttribute(activity, 'Sport') || 'Other';
  const title = textTag(activity, 'Name') || '';
  const records: RawPoint[] = [];

  for (const trackpoint of elements(activity, 'Trackpoint')) {
    if (records.length >= MAX_ACTIVITY_POINTS) throw new Error('This activity has too much recorded data to import.');
    const timestampMs = Date.parse(textTag(trackpoint, 'Time') || '');
    if (!Number.isFinite(timestampMs)) continue;
    const position = findElement(trackpoint, 'Position');
    const extensions = findElement(trackpoint, 'Extensions');
    const point: RawPoint = {
      timestampMs,
      elapsedSec: 0,
      distanceMeters: readNumber(trackpoint, 'DistanceMeters'),
      elevationMeters: readNumber(trackpoint, 'AltitudeMeters'),
      heartRateBpm: readNumber(trackpoint, 'Value', findElement(trackpoint, 'HeartRateBpm')),
      cadenceRpm: readNumber(trackpoint, 'Cadence'),
      speedMetersPerSecond: readNumber(extensions, 'Speed'),
      powerWatts: readNumber(extensions, 'Watts'),
      temperatureCelsius: readNumber(extensions, 'Temp'),
    };
    const latitude = readNumber(position, 'LatitudeDegrees');
    const longitude = readNumber(position, 'LongitudeDegrees');
    if (latitude !== null && longitude !== null) {
      (point as RawPoint & { latitude: number; longitude: number }).latitude = latitude;
      (point as RawPoint & { latitude: number; longitude: number }).longitude = longitude;
    }
    records.push(point);
  }

  const first = records[0];
  const last = records.at(-1);
  const startText = textTag(activity, 'Id');
  const lapDuration = [...elements(activity, 'Lap')]
    .map((lap) => readNumber(lap, 'TotalTimeSeconds') ?? 0)
    .reduce((sum, duration) => sum + duration, 0);
  const laps: RawLap[] = [...elements(activity, 'Lap')].flatMap((lap) => {
    const startMs = Date.parse(getAttribute(lap, 'StartTime') || '');
    const seconds = readNumber(lap, 'TotalTimeSeconds');
    return Number.isFinite(startMs) && seconds !== null && seconds > 0
      ? [{ startMs, endMs: startMs + seconds * 1000, timerSec: null }] : [];
  });
  return {
    title,
    sport,
    startedAt: startText || (first ? new Date(first.timestampMs).toISOString() : ''),
    durationSec: lapDuration || (first && last ? (last.timestampMs - first.timestampMs) / 1000 : 0),
    distanceMeters: maxNumber(records.map((point) => point.distanceMeters)),
    elevationGainMeters: cumulativeElevationGain(records),
    points: addPositionDistances(records),
    laps,
  };
}

function parseGpx(xml: string) {
  const trackName = textTag(findElement(xml, 'trk'), 'name') || textTag(xml, 'name') || '';
  const records: RawPoint[] = [];
  for (const trackpoint of elements(xml, 'trkpt')) {
    if (records.length >= MAX_ACTIVITY_POINTS) throw new Error('This activity has too much recorded data to import.');
    const timestampMs = Date.parse(textTag(trackpoint, 'time') || '');
    if (!Number.isFinite(timestampMs)) continue;
    const point: RawPoint = {
      timestampMs,
      elapsedSec: 0,
      distanceMeters: null,
      elevationMeters: readNumber(trackpoint, 'ele'),
      heartRateBpm: readNumber(trackpoint, 'hr'),
      cadenceRpm: readNumber(trackpoint, 'cad'),
      speedMetersPerSecond: readNumber(trackpoint, 'speed'),
      powerWatts: readNumber(trackpoint, 'power') ?? readNumber(trackpoint, 'watts'),
      temperatureCelsius: readNumber(trackpoint, 'atemp'),
    };
    const latitude = getAttribute(trackpoint, 'lat');
    const longitude = getAttribute(trackpoint, 'lon');
    if (latitude !== null && longitude !== null) {
      (point as RawPoint & { latitude: number; longitude: number }).latitude = Number(latitude);
      (point as RawPoint & { latitude: number; longitude: number }).longitude = Number(longitude);
    }
    records.push(point);
  }
  const first = records[0];
  const last = records.at(-1);
  const activityType = textTag(xml, 'type') || inferGpxSport(xml);
  return {
    title: trackName,
    sport: activityType,
    startedAt: first ? new Date(first.timestampMs).toISOString() : '',
    durationSec: first && last ? (last.timestampMs - first.timestampMs) / 1000 : 0,
    distanceMeters: null,
    elevationGainMeters: cumulativeElevationGain(records),
    points: addPositionDistances(records),
  };
}

function parseFit(view: DataView) {
  if (view.byteLength < 14 || view.getUint8(8) !== 0x2e || view.getUint8(9) !== 0x46 || view.getUint8(10) !== 0x49 || view.getUint8(11) !== 0x54) {
    throw new Error('This isn’t a FIT activity file TempoBuilder can read.');
  }

  const headerSize = view.getUint8(0);
  const dataSize = view.getUint32(4, true);
  const dataStart = headerSize;
  const dataEnd = dataStart + dataSize;
  if (headerSize < 12 || dataEnd + 2 !== view.byteLength) {
    throw new Error('This FIT file is incomplete or damaged. Export it again from your device or app.');
  }
  if (headerSize >= 14) {
    const headerCrc = view.getUint16(headerSize - 2, true);
    if (headerCrc !== 0 && fitCrc(view, 0, headerSize - 2) !== headerCrc) {
      throw new Error('This FIT file is damaged. Export it again from your device or app.');
    }
  }
  if (fitCrc(view, 0, dataEnd) !== view.getUint16(dataEnd, true)) {
    throw new Error('This FIT file is damaged. Export it again from your device or app.');
  }

  const definitions = new Map<number, FitDefinition>();
  const records: RawPoint[] = [];
  const laps: RawLap[] = [];
  let cursor = dataStart;
  let lastFitTimestamp: number | null = null;
  let sport = 'Other';
  let title = '';
  let startedAtMs: number | null = null;
  let durationSec = 0;
  let distanceMeters: number | null = null;
  let elevationGainMeters: number | null = null;

  while (cursor < dataEnd) {
    const header = view.getUint8(cursor++);
    const compressed = Boolean(header & 0x80);
    const isDefinition = compressed ? false : Boolean(header & 0x40);
    const localNumber = compressed ? (header >> 5) & 0x03 : header & 0x0f;

    if (isDefinition) {
      if (cursor + 5 > dataEnd) throw new Error('This FIT file is incomplete or damaged. Export it again from your device or app.');
      cursor += 1;
      const architecture = view.getUint8(cursor++);
      const bigEndian = architecture === 1;
      const globalMessage = readUint16(view, cursor, bigEndian);
      cursor += 2;
      const fieldCount = view.getUint8(cursor++);
      const fields: FitField[] = [];
      for (let index = 0; index < fieldCount; index += 1) {
        if (cursor + 3 > dataEnd) throw new Error('This FIT file is incomplete or damaged. Export it again from your device or app.');
        fields.push({ number: view.getUint8(cursor), size: view.getUint8(cursor + 1), baseType: view.getUint8(cursor + 2) });
        cursor += 3;
      }
      if (header & 0x20) {
        const developerCount = view.getUint8(cursor++);
        cursor += developerCount * 3;
      }
      definitions.set(localNumber, { globalMessage, bigEndian, fields });
      continue;
    }

    const definition = definitions.get(localNumber);
    if (!definition) throw new Error('This FIT file is incomplete or damaged. Export it again from your device or app.');
    const message: Record<number, number | null> = {};
    for (const field of definition.fields) {
      if (compressed && definition.globalMessage === 20 && field.number === 253) {
        message[field.number] = null;
        continue;
      }
      if (cursor + field.size > dataEnd) throw new Error('This FIT file is incomplete or damaged. Export it again from your device or app.');
      message[field.number] = readFitValue(view, cursor, field.size, field.baseType, definition.bigEndian);
      cursor += field.size;
    }
    if (header & 0x20 && !compressed) {
      const developerCount = view.getUint8(cursor++);
      for (let index = 0; index < developerCount; index += 1) {
        if (cursor + 2 > dataEnd) throw new Error('This FIT file is incomplete or damaged. Export it again from your device or app.');
        cursor += 2;
        const size = view.getUint8(cursor++);
        cursor += size;
      }
    }

    if (definition.globalMessage === 18) {
      sport = fitSport(message[5]) || sport;
      const sessionTimestamp = message[2];
      if (typeof sessionTimestamp === 'number') startedAtMs = fitTime(sessionTimestamp);
      durationSec = numberOr(durationSec, scaled(message[7] ?? message[8], 1000));
      if (message[9] !== null && message[9] !== undefined && message[9] > 0) distanceMeters = message[9] / 100;
      if (message[22] !== null && message[22] !== undefined && message[22] > 0) elevationGainMeters = message[22];
    } else if (definition.globalMessage === 19) {
      if (typeof message[2] === 'number' && typeof message[7] === 'number' && message[7] > 0 && laps.length < 500) {
        const startMs = fitTime(message[2]);
        laps.push({ startMs, endMs: startMs + message[7], timerSec: scaled(message[8], 1000) });
      }
    } else if (definition.globalMessage === 34) {
      const activityTimestamp = message[253];
      if (typeof activityTimestamp === 'number' && startedAtMs === null) startedAtMs = fitTime(activityTimestamp);
    } else if (definition.globalMessage === 20) {
      const fitTimestamp: number | null = compressed
        ? advanceCompressedTimestamp(lastFitTimestamp, header & 0x1f)
        : message[253] ?? null;
      if (typeof fitTimestamp !== 'number') continue;
      if (records.length >= MAX_ACTIVITY_POINTS) throw new Error('This activity has too much recorded data to import.');
      lastFitTimestamp = fitTimestamp;
      message[253] = fitTimestamp;
      if (startedAtMs === null) startedAtMs = fitTime(fitTimestamp);
      records.push({
        timestampMs: fitTime(fitTimestamp),
        elapsedSec: 0,
        distanceMeters: scaled(message[5], 100),
        heartRateBpm: message[3],
        cadenceRpm: message[4],
        speedMetersPerSecond: scaled(message[78] ?? message[6], 1000),
        powerWatts: message[7],
        elevationMeters: scaled(message[73] ?? message[2], 5, 500),
        temperatureCelsius: message[13],
      });
    }
  }

  const withDerived = addPositionDistances(records);
  const first = withDerived[0];
  const last = withDerived.at(-1);
  return {
    title,
    sport,
    startedAt: startedAtMs ? new Date(startedAtMs).toISOString() : first ? new Date(first.timestampMs).toISOString() : '',
    durationSec: durationSec || (first && last ? (last.timestampMs - first.timestampMs) / 1000 : 0),
    distanceMeters: distanceMeters ?? maxNumber(withDerived.map((point) => point.distanceMeters)),
    elevationGainMeters: elevationGainMeters ?? cumulativeElevationGain(withDerived),
    points: withDerived,
    laps,
  };
}

function normalizePoints(points: RawPoint[], startedAtMs: number): ActivitySeriesPoint[] {
  const deduplicated: ActivitySeriesPoint[] = [];
  let lastElapsed = -1;
  for (const point of points) {
    const elapsedSec = Math.max(0, Math.round((point.timestampMs - startedAtMs) / 1000));
    if (elapsedSec < lastElapsed) continue;
    if (elapsedSec > MAX_ACTIVITY_DURATION_SEC) break;
    const previous = deduplicated.at(-1);
    const distanceMeters = point.distanceMeters ?? null;
    const elapsedDelta = previous ? elapsedSec - previous.elapsedSec : 0;
    const distanceDelta = previous && distanceMeters !== null && previous.distanceMeters !== null && previous.distanceMeters !== undefined
      ? distanceMeters - previous.distanceMeters
      : null;
    const derivedSpeed = elapsedDelta > 0 && distanceDelta !== null && distanceDelta >= 0
      ? distanceDelta / elapsedDelta
      : null;
    const elevationDelta = previous && point.elevationMeters !== null && point.elevationMeters !== undefined && previous.elevationMeters !== null && previous.elevationMeters !== undefined
      ? point.elevationMeters - previous.elevationMeters
      : null;
    const derivedGrade = distanceDelta !== null && distanceDelta >= 5 && elevationDelta !== null
      ? Math.max(-50, Math.min(50, elevationDelta / distanceDelta * 100))
      : null;
    const clean: ActivitySeriesPoint & { latitude?: number; longitude?: number } = {
      elapsedSec,
      distanceMeters: finiteOrNull(distanceMeters),
      heartRateBpm: finiteOrNull(point.heartRateBpm),
      speedMetersPerSecond: finiteOrNull(point.speedMetersPerSecond ?? derivedSpeed),
      powerWatts: finiteOrNull(point.powerWatts),
      cadenceRpm: finiteOrNull(point.cadenceRpm),
      elevationMeters: finiteOrNull(point.elevationMeters),
      gradePercent: finiteOrNull(point.gradePercent ?? derivedGrade),
      temperatureCelsius: finiteOrNull(point.temperatureCelsius),
    };
    deduplicated.push(clean);
    lastElapsed = elapsedSec;
  }
  return deduplicated;
}

function addPositionDistances(points: RawPoint[]) {
  let distance = 0;
  let previous: { latitude: number; longitude: number } | null = null;
  return points.map((point) => {
    const withPosition = point as RawPoint & { latitude?: number; longitude?: number };
    if (Number.isFinite(withPosition.latitude) && Number.isFinite(withPosition.longitude)) {
      const current = { latitude: withPosition.latitude!, longitude: withPosition.longitude! };
      if (previous) distance += haversineDistance(previous.latitude, previous.longitude, current.latitude, current.longitude);
      previous = current;
    }
    return { ...point, distanceMeters: point.distanceMeters ?? distance };
  });
}

function cumulativeElevationGain(points: RawPoint[]) {
  let gain = 0;
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index].elevationMeters;
    const previous = points[index - 1].elevationMeters;
    if (current === null || current === undefined || previous === null || previous === undefined) continue;
    const change = current - previous;
    if (change > 0.5) gain += change;
  }
  return gain;
}

function* elements(xml: string, name: string) {
  const escaped = escapeRegExp(name);
  const pattern = new RegExp(`<((?:[\\w.-]+:)?${escaped})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
  for (const match of xml.matchAll(pattern)) yield match[0];
}

function findElement(xml: string, name: string) {
  return elements(xml, name).next().value ?? '';
}

function textTag(xml: string, name: string, within = xml) {
  const escaped = escapeRegExp(name);
  const match = new RegExp(`<(?:(?:[\\w.-]+):)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}\\s*>`, 'i').exec(within);
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function readNumber(xml: string, name: string, within = xml) {
  const text = textTag(within, name);
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function getAttribute(xml: string, name: string) {
  const escaped = escapeRegExp(name);
  const match = new RegExp(`\\b${escaped}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(xml);
  return match?.[2] ?? null;
}

function decodeEntities(value: string) {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (entity) => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'",
  })[entity] ?? entity);
}

function fitTime(value: number) {
  return FIT_EPOCH_MS + value * 1000;
}

function fitSport(value: number | null | undefined) {
  return ({ 0: 'Running', 1: 'Biking', 2: 'Transition', 3: 'Fitness Equipment', 4: 'Swimming', 5: 'Basketball', 6: 'Soccer', 8: 'Hiking', 10: 'Walking', 11: 'Alpine Skiing', 17: 'Wheelchair' } as Record<number, string>)[value ?? -1] ?? null;
}

function inferGpxSport(xml: string) {
  const type = textTag(xml, 'type');
  return type || 'Other';
}

function normalizeSport(input: string) {
  const sport = input.toLowerCase();
  if (/run|trail|treadmill|jog/.test(sport)) return 'RUNNING';
  if (/bik(e|ing)|cycl|ride|mtb|virtual/.test(sport)) return 'BIKING';
  if (/swim/.test(sport)) return 'SWIMMING';
  if (/strength|weight|gym|workout/.test(sport)) return 'STRENGTH';
  if (/yoga|stretch/.test(sport)) return 'STRETCHING';
  return 'OTHER';
}

function displaySport(input: string) {
  return input === 'OTHER' ? 'Other' : input.slice(0, 1) + input.slice(1).toLowerCase();
}

function boundedDuration(primary: number, fallback: number) {
  const value = Number.isFinite(primary) && primary > 0 ? primary : fallback;
  if (!Number.isFinite(value) || value <= 0 || value > MAX_ACTIVITY_DURATION_SEC) {
    throw new Error('Activities must last between 1 second and 36 hours.');
  }
  return Math.round(value);
}

function cleanText(input: string) {
  return input.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
}

function finiteOrNull(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function positiveOrNull(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0 ? value : null;
}

function maxNumber(values: Array<number | null | undefined>) {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return finite.length ? Math.max(...finite) : null;
}

function numberOr(current: number, candidate: number | null | undefined) {
  return candidate !== null && candidate !== undefined && Number.isFinite(candidate) && candidate > 0 ? candidate : current;
}

function scaled(value: number | null | undefined, scale: number, offset = 0) {
  return value === null || value === undefined || !Number.isFinite(value) ? null : value / scale - offset;
}

function readUint16(view: DataView, offset: number, bigEndian: boolean) {
  return view.getUint16(offset, !bigEndian);
}

function readFitValue(view: DataView, offset: number, size: number, rawType: number, bigEndian: boolean) {
  const type = rawType & 0x1f;
  const littleEndian = !bigEndian;
  let value: number;
  if (type === 0x01 && size === 1) value = view.getInt8(offset);
  else if ((type === 0x02 || type === 0x00 || type === 0x0a || type === 0x0d) && size === 1) value = view.getUint8(offset);
  else if (type === 0x03 && size >= 2) value = view.getInt16(offset, littleEndian);
  else if ((type === 0x04 || type === 0x0b) && size >= 2) value = view.getUint16(offset, littleEndian);
  else if (type === 0x05 && size >= 4) value = view.getInt32(offset, littleEndian);
  else if ((type === 0x06 || type === 0x0c) && size >= 4) value = view.getUint32(offset, littleEndian);
  else if (type === 0x08 && size >= 4) value = view.getFloat32(offset, littleEndian);
  else return null;
  if (!Number.isFinite(value)) return null;
  if (((type === 0x00 || type === 0x02) && value === (size === 1 ? 0xff : size === 2 ? 0xffff : 0xffffffff)) ||
      (type === 0x04 && value === (size === 2 ? 0xffff : 0xffffffff)) ||
      (type === 0x06 && value === 0xffffffff) ||
      (type === 0x0a && value === 0) || (type === 0x0b && value === 0) || (type === 0x0c && value === 0)) return null;
  if ((type === 0x01 && value === 0x7f) || (type === 0x03 && value === 0x7fff) || (type === 0x05 && value === 0x7fffffff)) return null;
  return value;
}

function advanceCompressedTimestamp(last: number | null, offset: number) {
  if (last === null) return null;
  let next = (last & ~0x1f) + offset;
  if (next <= last) next += 0x20;
  return next;
}

function fitCrc(view: DataView, start: number, end: number) {
  const table = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];
  let crc = 0;
  for (let offset = start; offset < end; offset += 1) {
    const byte = view.getUint8(offset);
    let value = table[crc & 0x0f];
    crc = ((crc >> 4) & 0x0fff) ^ value ^ table[byte & 0x0f];
    value = table[crc & 0x0f];
    crc = ((crc >> 4) & 0x0fff) ^ value ^ table[(byte >> 4) & 0x0f];
  }
  return crc;
}

function haversineDistance(latA?: number, lonA?: number, latB?: number, lonB?: number) {
  if (![latA, lonA, latB, lonB].every((value) => typeof value === 'number' && Number.isFinite(value))) return 0;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(latB! - latA!);
  const dLon = radians(lonB! - lonA!);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latA!)) * Math.cos(radians(latB!)) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function invalidFile(): never {
  throw new Error('Choose a .FIT, .TCX, or .GPX activity file.');
}
