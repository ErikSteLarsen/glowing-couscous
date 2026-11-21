'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { CalendarPlus, Check, Plus } from 'lucide-react';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { formFieldClassName, formLabelClassName, ghostButtonClassName, secondaryButtonClassName } from '@/components/ui';
import { getCalendarHref } from '@/lib/calendar-navigation';
import { addDayKeys, fromDayKey, toDayKey } from '@/lib/training-load';

type Status = { kind: 'idle' } | { kind: 'pending' } | { kind: 'done'; message: string; href: string; linkLabel: string } | { kind: 'error'; message: string };

async function post(url: string, body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Something went wrong. Try again.');
  return payload ?? {};
}

function newRequestKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function LibraryWorkoutActions({ slug, name, durationSec, hasSteps, from }: { slug: string; name: string; durationSec: number; hasSteps: boolean; from: 'library' | 'ride' }) {
  const scheduleId = useId();
  const [saveKey] = useState(newRequestKey);
  const [save, setSave] = useState<Status>({ kind: 'idle' });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => addDayKeys(toDayKey(new Date()), 1));
  const [schedule, setSchedule] = useState<Status>({ kind: 'idle' });
  // One key per submission: a retry after a lost response replays it instead of adding a copy.
  const [scheduleKey, setScheduleKey] = useState(newRequestKey);
  const base = `/api/athlete/library/${encodeURIComponent(slug)}`;

  async function addToWorkouts() {
    setSave({ kind: 'pending' });
    try {
      const result = await post(`${base}/workouts`, { requestKey: saveKey });
      setSave({ kind: 'done', message: 'Saved to your workouts.', href: `/athlete/workouts?edit=${String(result.sessionId)}`, linkLabel: 'Edit copy' });
    } catch (error) {
      setSave({ kind: 'error', message: error instanceof Error ? error.message : 'Could not save. Try again.' });
    }
  }

  async function scheduleWorkout(event: React.FormEvent) {
    event.preventDefault();
    setSchedule({ kind: 'pending' });
    try {
      await post(`${base}/schedule`, { dates: [scheduleDate], requestKey: scheduleKey });
      setScheduleKey(newRequestKey());
      setSchedule({ kind: 'done', message: `Scheduled for ${format(fromDayKey(scheduleDate), 'EEEE d MMMM')}.`, href: getCalendarHref('week', scheduleDate), linkLabel: 'Open calendar' });
    } catch (error) {
      setSchedule({ kind: 'error', message: error instanceof Error ? error.message : 'Could not schedule. Try again.' });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <WorkoutStartChooser
          workout={{ title: name, durationSec, sport: 'BIKING', status: 'planned', hasSteps }}
          source={{ kind: 'catalog', slug, from }}
        />
        <button type="button" className={secondaryButtonClassName} onClick={addToWorkouts} disabled={save.kind === 'pending' || save.kind === 'done'}>
          {save.kind === 'done' ? <Check aria-hidden="true" size={16} strokeWidth={1.8} /> : <Plus aria-hidden="true" size={16} strokeWidth={1.6} />}
          {save.kind === 'pending' ? 'Saving…' : save.kind === 'done' ? 'In your workouts' : 'Add to my workouts'}
        </button>
        <button type="button" className={secondaryButtonClassName} aria-expanded={scheduleOpen} aria-controls={scheduleId} onClick={() => setScheduleOpen((open) => !open)}>
          <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.6} />Schedule
        </button>
      </div>

      <div aria-live="polite" className="flex flex-col gap-1 empty:hidden">
        <StatusLine status={save} />
      </div>

      {scheduleOpen ? (
        <form id={scheduleId} onSubmit={scheduleWorkout} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end">
          <label className="min-w-0 sm:w-56">
            <span className={formLabelClassName}>Date for {name}</span>
            <input type="date" required className={formFieldClassName} value={scheduleDate} min={toDayKey(new Date())} onChange={(event) => { setScheduleDate(event.target.value); setScheduleKey(newRequestKey()); setSchedule({ kind: 'idle' }); }} />
          </label>
          <button type="submit" className={secondaryButtonClassName} disabled={schedule.kind === 'pending' || !scheduleDate}>
            {schedule.kind === 'pending' ? 'Scheduling…' : 'Add to calendar'}
          </button>
          <div className="min-w-0 sm:pb-2.5" aria-live="polite"><StatusLine status={schedule} /></div>
        </form>
      ) : null}
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'error') return <p role="alert" className="text-sm text-[var(--status-danger)]">{status.message}</p>;
  if (status.kind !== 'done') return null;
  return (
    <p className="inline-flex flex-wrap items-center gap-x-2 text-sm text-[var(--status-success)]">
      {status.message}
      <Link href={status.href} className={`${ghostButtonClassName('compact')} -my-1`}>{status.linkLabel}</Link>
    </p>
  );
}
