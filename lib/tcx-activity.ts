import { SaxesParser } from 'saxes';
import { isValid, parseISO } from 'date-fns';
import { getTcxCalendarDay } from './tcx-time.ts';
import { MAX_ACTIVITY_IMPORT_BYTES } from './activity-import-limits.ts';

export { MAX_ACTIVITY_IMPORT_BYTES };
export const MAX_TCX_BYTES = MAX_ACTIVITY_IMPORT_BYTES;

export type ParsedTcxActivity = {
  sport: 'RUNNING' | 'BIKING' | 'SWIMMING';
  title: string;
  startedAt: Date;
  completedAt: Date;
  completedOn: string;
  sourceTimezoneOffsetMinutes: number;
  durationSec: number;
  distanceMeters: number | null;
};

export type TcxParseResult =
  | { ok: true; activity: ParsedTcxActivity }
  | { ok: false; error: string };

const sportMap: Record<string, ParsedTcxActivity['sport']> = {
  running: 'RUNNING',
  biking: 'BIKING',
  swimming: 'SWIMMING',
};

function positiveNumber(value: string | undefined) {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

export function parseTcxActivity(xml: string): TcxParseResult {
  if (Buffer.byteLength(xml, 'utf8') > MAX_TCX_BYTES) {
    return { ok: false, error: 'TCX files must be 5 MB or smaller.' };
  }

  try {
    const stack: string[] = [];
    const activity = { sport: '', title: '', startedAt: '', durationSec: 0, distanceMeters: 0 };
    let activityCount = 0;
    let inActivity = false;
    let lapDepth = -1;
    let capture: { name: string; depth: number; text: string } | null = null;
    let elementCount = 0;
    const parser = new SaxesParser({ xmlns: true });

    parser.on('doctype', () => { throw new Error('DOCTYPE is not allowed.'); });
    parser.on('opentag', (tag) => {
      elementCount += 1;
      if (elementCount > 150_000) throw new Error('TCX contains too many elements.');
      const name = tag.local.toLowerCase();
      stack.push(name);
      if (stack.length === 1 && name !== 'trainingcenterdatabase') throw new Error('Unsupported XML root.');
      if (name === 'activity' && stack.length === 3 && stack[0] === 'trainingcenterdatabase' && stack[1] === 'activities') {
        activityCount += 1;
        if (activityCount > 1) throw new Error('Import one completed activity per file.');
        inActivity = true;
        activity.sport = String(Object.values(tag.attributes).find((attribute) => attribute.name.toLowerCase() === 'sport')?.value ?? '');
      } else if (inActivity && name === 'lap') {
        lapDepth = stack.length;
      } else if (inActivity && stack.length === 4 && stack[1] === 'activities' && stack[2] === 'activity' && ['id', 'name'].includes(name)) {
        capture = { name, depth: stack.length, text: '' };
      } else if (inActivity && lapDepth >= 0 && ['totaltimeseconds', 'distancemeters'].includes(name) && stack.length === lapDepth + 1) {
        capture = { name, depth: stack.length, text: '' };
      }
    });
    parser.on('text', (text) => {
      if (capture) capture.text += text;
    });
    parser.on('cdata', (text) => {
      if (capture) capture.text += text;
    });
    parser.on('closetag', (tag) => {
      const name = tag.local.toLowerCase();
      if (capture && capture.depth === stack.length && capture.name === name) {
        const value = capture.text.trim();
        if (capture.name === 'id') activity.startedAt = value;
        else if (capture.name === 'name') activity.title = value;
        else if (capture.name === 'totaltimeseconds') activity.durationSec += positiveNumber(value) ?? 0;
        else if (capture.name === 'distancemeters') activity.distanceMeters += positiveNumber(value) ?? 0;
        capture = null;
      }
      if (name === 'lap' && stack.length === lapDepth) lapDepth = -1;
      if (name === 'activity') inActivity = false;
      stack.pop();
    });
    parser.write(xml).close();

    const sport = sportMap[activity.sport.toLowerCase()];
    if (!activityCount || !sport) {
      return { ok: false, error: `This TCX activity sport (“${activity.sport || 'unknown'}”) is not supported. Choose a supported activity file.` };
    }
    const startedAt = parseISO(activity.startedAt);
    if (!isValid(startedAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(activity.startedAt)) {
      return { ok: false, error: 'TCX activity must include a valid start time with a time zone.' };
    }
    const sourceTimezoneOffsetMinutes = parseTimezoneOffsetMinutes(activity.startedAt);
    if (sourceTimezoneOffsetMinutes === null) {
      return { ok: false, error: 'TCX activity must include a valid start time with a time zone.' };
    }
    if (!Number.isFinite(activity.durationSec) || activity.durationSec < 1) {
      return { ok: false, error: 'No completed activity duration was found in this TCX file.' };
    }
    const durationSec = Math.round(activity.durationSec);
    const completedAt = new Date(startedAt.getTime() + durationSec * 1000);
    const completedOn = getTcxCalendarDay(completedAt, sourceTimezoneOffsetMinutes);
    return {
      ok: true,
      activity: {
        sport,
        title: activity.title.trim().slice(0, 120) || `${sport[0]}${sport.slice(1).toLowerCase()} activity`,
        startedAt,
        completedAt,
        completedOn,
        sourceTimezoneOffsetMinutes,
        durationSec,
        distanceMeters: activity.distanceMeters > 0 ? Math.round(activity.distanceMeters) : null,
      },
    };
  } catch {
    return { ok: false, error: 'This file is not a valid supported TCX activity.' };
  }
}
