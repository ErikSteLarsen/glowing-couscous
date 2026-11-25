import { Decoder, Stream } from '@garmin/fitsdk';
import type { FitMessages } from '@garmin/fitsdk';
import { MAX_ACTIVITY_IMPORT_BYTES } from './activity-import-limits.ts';
import { getTcxCalendarDay } from './tcx-time.ts';

export const MAX_FIT_BYTES = MAX_ACTIVITY_IMPORT_BYTES;
const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);
const FIT_DATE_TIME_MIN = 0x10000000;

export type ParsedFitActivity = {
  sport: 'RUNNING' | 'BIKING' | 'SWIMMING';
  title: string;
  startedAt: Date;
  completedAt: Date;
  completedOn: string;
  sourceTimezoneOffsetMinutes: number;
  durationSec: number;
  distanceMeters: number | null;
};

export type FitParseResult =
  | { ok: true; activity: ParsedFitActivity }
  | { ok: false; error: string };

const sportMap: Record<string, ParsedFitActivity['sport']> = {
  running: 'RUNNING',
  cycling: 'BIKING',
  swimming: 'SWIMMING',
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function fitDate(value: unknown) {
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value < FIT_DATE_TIME_MIN) return null;
  const date = new Date(FIT_EPOCH_MS + value * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getTimezoneOffsetMinutes(activityTimestamp: unknown, localTimestamp: unknown) {
  if (!isFiniteNumber(activityTimestamp) || !Number.isInteger(activityTimestamp) || activityTimestamp < FIT_DATE_TIME_MIN
    || !isFiniteNumber(localTimestamp) || !Number.isInteger(localTimestamp) || localTimestamp < FIT_DATE_TIME_MIN) return null;
  const seconds = localTimestamp - activityTimestamp;
  if (!Number.isInteger(seconds) || seconds % 60 !== 0) return null;
  const minutes = seconds / 60;
  return minutes >= -720 && minutes <= 840 ? minutes : null;
}

function unsupported(error: string): FitParseResult {
  return { ok: false, error };
}

function parseMessages(messages: FitMessages): FitParseResult {
  const files = messages.fileIdMesgs ?? [];
  if (files.length !== 1 || files[0]?.type !== 'activity') {
    return unsupported('This FIT file isn’t an activity. Choose an activity file from your device or app.');
  }

  const activities = messages.activityMesgs ?? [];
  if (activities.length !== 1) {
    return unsupported('This FIT file must hold exactly one activity.');
  }

  const sessions = messages.sessionMesgs ?? [];
  if (sessions.length !== 1 || activities[0]?.numSessions !== 1 || activities[0]?.type === 'autoMultiSport') {
    return unsupported('This FIT file holds more than one sport, or part of it is missing. Import one activity at a time.');
  }

  const session = sessions[0];
  const activity = activities[0];
  const sport = sportMap[String(session?.sport ?? '').toLowerCase()];
  if (!sport) {
    return unsupported(`Wattonaut can’t import this sport (“${String(session?.sport ?? 'unknown')}”). Choose a single run, ride or swim.`);
  }

  const startedAt = fitDate(session.startTime);
  const completedAt = fitDate(session.timestamp);
  const sourceTimezoneOffsetMinutes = getTimezoneOffsetMinutes(activity.timestamp, activity.localTimestamp);
  if (!startedAt || !completedAt || completedAt <= startedAt) {
    return unsupported('This FIT activity has no valid start or finish time.');
  }
  if (!isFiniteNumber(activity.timestamp) || activity.timestamp !== session.timestamp) {
    return unsupported('This FIT activity’s finish times don’t match.');
  }
  if (sourceTimezoneOffsetMinutes === null) {
    return unsupported('This FIT activity has no local time, so Wattonaut can’t tell which day you did it.');
  }
  if (!isFiniteNumber(session.totalElapsedTime) || session.totalElapsedTime < 1) {
    return unsupported('This FIT activity has no valid duration.');
  }
  if (isFiniteNumber(session.totalDistance) && session.totalDistance < 0) {
    return unsupported('This FIT activity’s distance can’t be read.');
  }

  const durationSec = Math.round(session.totalElapsedTime);
  const completedOn = getTcxCalendarDay(completedAt, sourceTimezoneOffsetMinutes);
  return {
    ok: true,
    activity: {
      sport,
      title: `${sport[0]}${sport.slice(1).toLowerCase()} activity`,
      startedAt,
      completedAt,
      completedOn,
      sourceTimezoneOffsetMinutes,
      durationSec,
      distanceMeters: isFiniteNumber(session.totalDistance) && session.totalDistance > 0
        ? Math.round(session.totalDistance)
        : null,
    },
  };
}

export function parseFitActivity(bytes: Uint8Array): FitParseResult {
  if (bytes.byteLength > MAX_FIT_BYTES) return unsupported('FIT files must be 5 MB or smaller.');
  if (!bytes.byteLength) return unsupported('The selected FIT file is empty.');

  try {
    const decoder = new Decoder(Stream.fromBuffer(Buffer.from(bytes)));
    if (!decoder.isFIT()) return unsupported('Choose a valid .fit activity file.');
    if (!decoder.checkIntegrity()) return unsupported('This FIT file is incomplete or damaged. Export it again from your device or app.');
    const { messages, errors } = decoder.read({
      convertDateTimesToDates: false,
      includeUnknownData: false,
      mergeHeartRates: false,
      decodeMemoGlobs: false,
    });
    if (errors.length) return unsupported('This FIT file couldn’t be read in full. Export it again from your device or app.');
    return parseMessages(messages);
  } catch {
    return unsupported('This file isn’t a FIT activity Wattonaut can read.');
  }
}
