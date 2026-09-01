'use client';

import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { useMemo, useState } from 'react';

import {
  Badge,
  dangerTextClassName,
  formFieldClassName,
  formSelectClassName,
  primaryButtonClassName,
  Surface,
  successTextClassName,
} from '@/components/ui';

type Source =
  | { kind: 'template'; templateId: number }
  | { kind: 'library-session'; sessionId: number }
  | { kind: 'training-plan'; trainingPlanId: number };

type SourceOption = { value: string; label: string; source: Source; preview: string };

export function SourceAssignmentPanel({
  athletes,
  templates,
  librarySessions,
  trainingPlans,
  initialDate,
}: {
  athletes: Array<{ id: number; name: string }>;
  templates: Array<{ id: number; name: string }>;
  librarySessions: Array<{ id: number; title: string }>;
  trainingPlans: Array<{ id: number; name: string; sessions: Array<{ title: string; planWeekday: number | null }> }>;
  initialDate: string;
}) {
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? 0);
  const [date, setDate] = useState(initialDate);
  const [weekStart, setWeekStart] = useState(format(startOfWeek(parseISO(initialDate), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [sourceKey, setSourceKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const options = useMemo<SourceOption[]>(
    () => [
      ...templates.map((template) => ({ value: `template:${template.id}`, label: `Template · ${template.name}`, source: { kind: 'template' as const, templateId: template.id }, preview: template.name })),
      ...librarySessions.map((session) => ({ value: `library:${session.id}`, label: `Library · ${session.title}`, source: { kind: 'library-session' as const, sessionId: session.id }, preview: session.title })),
      ...trainingPlans.map((plan) => ({ value: `plan:${plan.id}`, label: `Training plan · ${plan.name}`, source: { kind: 'training-plan' as const, trainingPlanId: plan.id }, preview: `${plan.sessions.length} weekday sessions` })),
    ],
    [librarySessions, templates, trainingPlans],
  );
  const selected = options.find((option) => option.value === sourceKey) ?? null;
  const selectedTrainingPlanId = selected?.source.kind === 'training-plan'
    ? (selected.source as { kind: 'training-plan'; trainingPlanId: number }).trainingPlanId
    : null;
  const selectedPlan = selectedTrainingPlanId !== null
    ? trainingPlans.find((plan) => plan.id === selectedTrainingPlanId)
    : null;
  const weekDate = parseISO(weekStart);

  async function assign() {
    if (!athleteId || !selected) {
      setError('Choose an athlete and reusable source first.');
      return;
    }
    setSaving(true);
    setMessage('');
    setError('');
    const response = await fetch('/api/coach/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        athleteId,
        source: selected.source,
        scheduledDate: date,
        weekStart,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; sessionId?: number; sessionIds?: number[] };
    setSaving(false);
    if (!response.ok) {
      setError(payload.error ?? 'Assignment failed.');
      return;
    }
    const count = payload.sessionIds?.length ?? 1;
    setMessage(count > 1 ? `${count} sessions assigned or reused.` : 'Source assigned or reused.');
  }

  return (
    <Surface className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Source copy</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Assign reusable content</h2>
        </div>
        <Badge tone="brand">Snapshot</Badge>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">Copies are independent.</p>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[var(--text-secondary)]">Athlete</span>
        <select className={formSelectClassName} value={athleteId} onChange={(event) => setAthleteId(Number(event.target.value))}>
          {athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.name}</option>)}
        </select>
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[var(--text-secondary)]">Reusable source</span>
        <select className={formSelectClassName} value={sourceKey} onChange={(event) => setSourceKey(event.target.value)}>
          <option value="">Choose source</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      {selected?.source.kind === 'training-plan' ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Target Monday week</span>
          <input type="date" className={formFieldClassName} value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
        </label>
      ) : (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Target date</span>
          <input type="date" className={formFieldClassName} value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      )}
      {selected ? (
        <div className="rounded-[10px] bg-[#FBFAF7] p-3 text-sm text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text)]">Preview · {selected.preview}</p>
          {selectedPlan ? (
            <ul className="mt-2 space-y-1">
              {selectedPlan.sessions.map((session, index) => (
                <li key={`${session.title}-${index}`}>
                  {session.planWeekday ? format(addDays(weekDate, session.planWeekday - 1), 'EEE d MMM') : 'Invalid weekday'} · {session.title}
                </li>
              ))}
            </ul>
          ) : <p className="mt-1">{format(parseISO(date), 'EEE d MMM yyyy')}</p>}
        </div>
      ) : null}
      <button type="button" className={primaryButtonClassName} disabled={saving || options.length === 0} onClick={() => void assign()}>
        {saving ? 'Assigning…' : 'Assign source'}
      </button>
      {message ? <p className={successTextClassName}>{message}</p> : null}
      {error ? <p className={dangerTextClassName}>{error}</p> : null}
    </Surface>
  );
}
