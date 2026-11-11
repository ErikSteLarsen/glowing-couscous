import { format, isValid } from 'date-fns';
import type { AthleteEvent } from '@prisma/client';
import { prisma } from './prisma.ts';
import { getTcxCalendarDay } from './tcx-time.ts';

const EVENT_SPORTS = ['RUNNING', 'BIKING', 'SWIMMING', 'TRIATHLON'] as const;
const MAX_TITLE_LENGTH = 120;
const MAX_NOTE_LENGTH = 500;
const MAX_FINISH_SECONDS = 172_800;
type EventDb = typeof prisma;
type EventInput = { title?: unknown; sport?: unknown; eventDate?: unknown; targetFinishSec?: unknown };
type ResultInput = { resultFinishSec?: unknown; resultNote?: unknown };
type EventError = { ok: false; status: 400 | 404; error: string };
type EventSuccess<T> = { ok: true; value: T };

function dateKey(value: Date) { return value.toISOString().slice(0, 10); }
function activityReviewValue<T extends { completedAt: Date; sourceTimezoneOffsetMinutes: number | null }>(activity: T) {
  const { sourceTimezoneOffsetMinutes, completedAt, ...summary } = activity;
  return { ...summary, completedOn: sourceTimezoneOffsetMinutes === null ? format(completedAt, 'yyyy-MM-dd') : getTcxCalendarDay(completedAt, sourceTimezoneOffsetMinutes) };
}
function parseDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return isValid(date) && dateKey(date) === value ? date : null;
}
function parseFinishTime(value: unknown, optional: boolean) {
  if (optional && (value === null || value === undefined || value === '')) return { ok: true as const, value: null };
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > MAX_FINISH_SECONDS) return { ok: false as const };
  return { ok: true as const, value: Number(value) };
}
function parseEvent(input: EventInput): { error: string } | { value: { title: string; sport: string; eventDate: Date; targetFinishSec: number | null } } {
  if (typeof input.title !== 'string' || input.title.trim().length < 1 || input.title.trim().length > MAX_TITLE_LENGTH) return { error: `Event name must be between 1 and ${MAX_TITLE_LENGTH} characters.` };
  if (typeof input.sport !== 'string' || !EVENT_SPORTS.includes(input.sport as (typeof EVENT_SPORTS)[number])) return { error: 'Choose a valid event sport.' };
  const eventDate = parseDate(input.eventDate);
  if (!eventDate) return { error: 'Choose a valid event date.' };
  const target = parseFinishTime(input.targetFinishSec, true);
  if (!target.ok) return { error: 'Goal finish time must be a whole number of seconds from 1 to 48 hours.' };
  return { value: { title: input.title.trim(), sport: input.sport as string, eventDate, targetFinishSec: target.value } };
}

export function createAthleteEventService({ db = prisma }: { db?: EventDb } = {}) {
  async function athleteExists(athleteId: number) {
    const user = await db.user.findUnique({ where: { id: athleteId }, select: { id: true, role: true } });
    return Boolean(user && user.role === 'ATHLETE');
  }
  async function ownedEvent(athleteId: number, eventId: number) {
    return db.athleteEvent.findFirst({ where: { id: eventId, athleteId } });
  }
  return {
    async list(athleteId: number) {
      if (!await athleteExists(athleteId)) return null;
      const events = await db.athleteEvent.findMany({ where: { athleteId }, include: { activities: { where: { athleteId, session: { athleteId, status: 'completed' } }, select: { id: true, completedAt: true, sourceTimezoneOffsetMinutes: true, durationSec: true, distanceMeters: true, session: { select: { title: true, sport: true } } }, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }] } }, orderBy: [{ eventDate: 'asc' }, { id: 'asc' }] });
      return events.map((event) => ({ ...event, activities: event.activities.map(activityReviewValue) }));
    },
    async create(athleteId: number, input: EventInput): Promise<EventError | EventSuccess<AthleteEvent>> {
      const parsed = parseEvent(input);
      if ('error' in parsed) return { ok: false, status: 400, error: parsed.error };
      if (!await athleteExists(athleteId)) return { ok: false, status: 404, error: 'Athlete not found.' };
      return { ok: true, value: await db.athleteEvent.create({ data: { athleteId, ...parsed.value } }) };
    },
    async update(athleteId: number, eventId: number, input: EventInput): Promise<EventError | EventSuccess<AthleteEvent>> {
      const parsed = parseEvent(input);
      if ('error' in parsed) return { ok: false, status: 400, error: parsed.error };
      const current = await ownedEvent(athleteId, eventId);
      if (!current) return { ok: false, status: 404, error: 'Event not found.' };
      if (current.resultFinishSec !== null && dateKey(parsed.value.eventDate) > dateKey(new Date())) return { ok: false, status: 400, error: 'An event with a recorded result cannot be moved into the future.' };
      return { ok: true, value: await db.athleteEvent.update({ where: { id: current.id }, data: parsed.value }) };
    },
    async recordResult(athleteId: number, eventId: number, input: ResultInput): Promise<EventError | EventSuccess<AthleteEvent>> {
      const current = await ownedEvent(athleteId, eventId);
      if (!current) return { ok: false, status: 404, error: 'Event not found.' };
      if (dateKey(current.eventDate) > dateKey(new Date())) return { ok: false, status: 400, error: 'Results can be recorded on or after the event date.' };
      const finish = parseFinishTime(input.resultFinishSec, false);
      if (!finish.ok) return { ok: false, status: 400, error: 'Result finish time must be a whole number of seconds from 1 to 48 hours.' };
      if (input.resultNote !== null && input.resultNote !== undefined && (typeof input.resultNote !== 'string' || input.resultNote.length > MAX_NOTE_LENGTH)) return { ok: false, status: 400, error: `Result note must be ${MAX_NOTE_LENGTH} characters or fewer.` };
      const resultNote = typeof input.resultNote === 'string' && input.resultNote.trim() ? input.resultNote.trim() : null;
      return { ok: true, value: await db.athleteEvent.update({ where: { id: current.id }, data: { resultFinishSec: finish.value, resultNote } }) };
    },
    async searchActivities(athleteId: number, eventId: number, query: unknown, page: number) {
      const current = await ownedEvent(athleteId, eventId);
      if (!current) return { ok: false as const, status: 404 as const, error: 'Event not found.' };
      const term = typeof query === 'string' ? query.trim().slice(0, 100) : '';
      const where = { athleteId, eventId: null, session: { athleteId, status: 'completed', ...(term ? { OR: [{ title: { contains: term } }, { sport: { contains: term } }] } : {}) } };
      const [activities, total] = await Promise.all([
        db.activity.findMany({ where, select: { id: true, completedAt: true, sourceTimezoneOffsetMinutes: true, durationSec: true, distanceMeters: true, session: { select: { title: true, sport: true } } }, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }], skip: Math.max(0, page) * 30, take: 30 }),
        db.activity.count({ where }),
      ]);
      return { ok: true as const, value: { activities: activities.map(activityReviewValue), total, page: Math.max(0, page), pageSize: 30 } };
    },
    async linkActivity(athleteId: number, eventId: number, activityId: unknown): Promise<EventError | EventSuccess<unknown>> {
      if (!Number.isInteger(activityId) || Number(activityId) < 1) return { ok: false, status: 400, error: 'Choose a valid activity.' };
      const event = await ownedEvent(athleteId, eventId);
      if (!event) return { ok: false, status: 404, error: 'Event not found.' };
      const activity = await db.activity.findFirst({ where: { id: Number(activityId), athleteId }, include: { session: { select: { athleteId: true, status: true } } } });
      if (!activity) return { ok: false, status: 404, error: 'Activity not found.' };
      if (activity.session.athleteId !== athleteId || activity.session.status !== 'completed') return { ok: false, status: 400, error: 'Only your completed activities can be linked.' };
      if (activity.eventId !== null && activity.eventId !== eventId) return { ok: false, status: 400, error: 'This activity is already linked to another event.' };
      if (activity.eventId === eventId) return { ok: true, value: activity };
      const linked = await db.activity.updateMany({ where: { id: activity.id, athleteId, eventId: null, session: { status: 'completed' } }, data: { eventId } });
      if (linked.count === 0) return { ok: false, status: 400, error: 'This activity is already linked to another event.' };
      return { ok: true, value: await db.activity.findUnique({ where: { id: activity.id } }) };
    },
    async unlinkActivity(athleteId: number, eventId: number, activityId: number): Promise<EventError | { ok: true }> {
      const event = await ownedEvent(athleteId, eventId);
      if (!event) return { ok: false, status: 404, error: 'Event not found.' };
      const unlinked = await db.activity.updateMany({ where: { id: activityId, athleteId, eventId }, data: { eventId: null } });
      if (unlinked.count === 0) return { ok: false, status: 404, error: 'Linked activity not found.' };
      return { ok: true };
    },
    async delete(athleteId: number, eventId: number): Promise<EventError | { ok: true }> {
      const current = await ownedEvent(athleteId, eventId);
      if (!current) return { ok: false, status: 404, error: 'Event not found.' };
      await db.athleteEvent.delete({ where: { id: current.id } });
      return { ok: true };
    },
  };
}

export const athleteEventService = createAthleteEventService();
