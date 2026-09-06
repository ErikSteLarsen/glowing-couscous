'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  ActionLink,
  compactDangerButtonClassName,
  compactListButtonClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  EmptyState,
  dangerTextClassName,
  formSelectClassName,
  primaryButtonClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';
import { SessionComposer } from '@/components/SessionComposer';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import {
  createEmptyPlannerEditorDraft,
  createPlannerEditorDraftFromTemplate,
  type PlannerEditorTemplateRecord,
} from '@/lib/session-editor-adapters';
import {
  createSessionEditorDraftFromPersisted,
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
  type SessionEditorDraft,
} from '@/lib/session-editor';

type AthletePlannerSession = {
  id: number;
  athleteId: number | null;
  templateId: number | null;
  scheduledDate: string;
  timeLabel: string | null;
  sport: string;
  title: string;
  summary: string | null;
  status: string;
  source: string;
  adjusted: boolean;
  sportMetricsJson: string | null;
  durationSec: number;
  tss: number;
  blocks: PlannerEditorTemplateRecord['blocks'];
};

type AthletePlannerDay = {
  isoDate: string;
  label: string;
  dateLabel: string;
  sessions: AthletePlannerSession[];
};

export function AthletePlannerClient({
  athleteId,
  templates,
  days,
  periodLabel,
  initialDate,
  initialTemplateId,
}: {
  athleteId: number;
  templates: PlannerEditorTemplateRecord[];
  days: AthletePlannerDay[];
  periodLabel: string;
  initialDate: string;
  initialTemplateId: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedDates, setSelectedDates] = useState([initialDate]);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [draft, setDraft] = useState<SessionEditorDraft>(() => {
    const initialTemplate = templates.find((template) => template.id === initialTemplateId);
    return initialTemplate
      ? createPlannerEditorDraftFromTemplate(initialTemplate, {
          athleteId,
          scheduledDate: initialDate,
        })
      : createEmptyPlannerEditorDraft({ athleteId, scheduledDate: initialDate });
  });

  function startNewSession(date = selectedDates[0] ?? initialDate) {
    setEditingSessionId(null);
    setSelectedDates([date]);
    setMessage('');
    setDraft(createEmptyPlannerEditorDraft({ athleteId, scheduledDate: date }));
  }

  function toggleDate(date: string) {
    if (editingSessionId) return;
    setSelectedDates((current) =>
      current.includes(date) ? current.filter((value) => value !== date) : [...current, date].sort(),
    );
    setDraft((current) => ({ ...current, scheduledDate: date }));
  }

  function loadSession(session: AthletePlannerSession) {
    setEditingSessionId(session.id);
    setSelectedDates([session.scheduledDate]);
    setMessage('');
    setDraft(
      createSessionEditorDraftFromPersisted('planned', {
        ...session,
        date: session.scheduledDate,
        scheduledDate: session.scheduledDate,
      }),
    );
  }

  function loadTemplate(templateId: string) {
    if (!templateId) {
      setEditingSessionId(null);
      setMessage('');
      setDraft(createEmptyPlannerEditorDraft({ athleteId, scheduledDate: selectedDates[0] ?? initialDate }));
      return;
    }

    const template = templates.find((item) => item.id === Number(templateId));
    if (!template) return;
    setEditingSessionId(null);
    setMessage('');
    setDraft(
      createPlannerEditorDraftFromTemplate(template, {
        athleteId,
        scheduledDate: selectedDates[0] ?? initialDate,
      }),
    );
  }

  function saveSession() {
    if (selectedDates.length === 0) {
      setMessageTone('danger');
      setMessage('Choose at least one day.');
      return;
    }

    const draftForSave = { ...draft, athleteId, scheduledDate: selectedDates[0] };
    const validationError = validateSessionEditorDraft(draftForSave);
    if (validationError) {
      setMessageTone('danger');
      setMessage(validationError);
      return;
    }

    startTransition(() => {
      void saveDraft(draftForSave);
    });
  }

  async function saveDraft(draftForSave: SessionEditorDraft) {
    const response = await fetch(
      editingSessionId ? `/api/athlete/planner/sessions/${editingSessionId}` : '/api/athlete/planner/sessions',
      {
        method: editingSessionId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...serializeSessionEditorDraft(draftForSave), dates: selectedDates }),
      },
    );
    const payload = await response.json().catch(() => ({})) as { error?: string; sessionIds?: number[] };
    if (!response.ok) {
      setMessageTone('danger');
      setMessage(payload.error ?? 'Failed to save session.');
      return;
    }

    setMessageTone('success');
    setMessage(editingSessionId ? 'Session updated.' : `${payload.sessionIds?.length ?? selectedDates.length} session(s) saved.`);
    router.refresh();
  }

  function deleteSession() {
    if (!editingSessionId) return;
    startTransition(async () => {
      const response = await fetch(`/api/athlete/planner/sessions/${editingSessionId}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to delete session.');
        return;
      }

      setMessageTone('success');
      setMessage('Session deleted.');
      startNewSession();
      router.refresh();
    });
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[0.9fr_1.4fr_0.8fr]">
      <Surface className="min-w-0 space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Week</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{periodLabel}</h2>
          <p className="mt-1 max-w-[32ch] text-sm leading-6 text-[var(--text-secondary)]">
            {editingSessionId ? 'Select one day to edit.' : 'Select one or more days.'}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {days.map((day) => (
            <div
              key={day.isoDate}
              className={`rounded-[12px] border p-2.5 transition sm:p-3 ${
                selectedDates.includes(day.isoDate)
                  ? 'border-[var(--field-focus)] bg-[var(--brand-tint)] ring-1 ring-[var(--field-focus)]'
                  : 'border-[var(--border)] bg-[#FBFAF7]'
              }`}
            >
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[9px] px-1">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--brand)]"
                  checked={selectedDates.includes(day.isoDate)}
                  disabled={editingSessionId !== null}
                  aria-label={`Select ${day.label} ${day.dateLabel}`}
                  onChange={() => toggleDate(day.isoDate)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text)]">{day.label}</span>
                  <span className="block text-xs text-[var(--text-secondary)]">{day.dateLabel}</span>
                </span>
                <Badge>{day.sessions.length}</Badge>
              </label>
              {day.sessions.length > 0 ? (
                <span className="mt-2 block space-y-1 pl-7">
                  {day.sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => loadSession(session)}
                      className={`${compactListButtonClassName} min-h-10 flex-col items-start gap-0.5 px-2 py-1.5 text-xs`}
                    >
                      <span className="w-full break-words font-semibold">{session.title}</span>
                      <span className="w-full text-[11px] text-[var(--text-secondary)]">
                        {getSportLabel(session.sport)} · {formatDuration(session.durationSec)} · {session.tss} TSS
                      </span>
                    </button>
                  ))}
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <button type="button" className={`${compactSecondaryButtonClassName} w-full`} onClick={() => startNewSession()}>
          New session
        </button>
      </Surface>

      <Surface className="min-w-0 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Session editor</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">
              {editingSessionId ? 'Edit session' : 'Create session'}
            </h2>
          </div>
          <Badge tone="brand">Private</Badge>
        </div>

        {templates.length > 0 ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Use template</span>
            <select className={formSelectClassName} value={draft.templateId ?? ''} onChange={(event) => loadTemplate(event.target.value)}>
              <option value="">Start from scratch</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
        ) : null}

        <SessionComposer
          draft={draft}
          onChange={(next) => setDraft((current) => ({ ...next, athleteId, templateId: current.templateId }))}
          showSportMetrics
          summaryPlaceholder="Session intent"
          durationUnit="minutes"
        />
      </Surface>

      <Surface className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Save</p>
          <p className="mt-2 text-sm font-medium text-[var(--text)]">
            {selectedDates.length} day{selectedDates.length === 1 ? '' : 's'} selected.
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            {editingSessionId ? 'Changes update the selected planned session.' : 'A separate session is created for each selected day.'}
          </p>
        </div>
        <button type="button" disabled={isPending} className={`${primaryButtonClassName} w-full`} onClick={saveSession}>
          {isPending ? 'Saving…' : editingSessionId ? 'Save changes' : 'Save session'}
        </button>
        {editingSessionId ? (
          <button type="button" disabled={isPending} className={`${compactDangerButtonClassName} w-full`} onClick={deleteSession}>
            Delete session
          </button>
        ) : null}
        {message ? (
          <p
            role={messageTone === 'danger' ? 'alert' : 'status'}
            aria-live="polite"
            className={messageTone === 'success' ? successTextClassName : dangerTextClassName}
          >
            {message}
          </p>
        ) : null}
        {templates.length === 0 ? (
          <div className="space-y-3">
            <EmptyState title="No templates yet" description="Save a reusable starting point from the Templates menu." />
            <ActionLink href="/athlete/templates" tone="secondary" size="compact">
              Open templates
            </ActionLink>
          </div>
        ) : null}
      </Surface>
    </div>
  );
}
