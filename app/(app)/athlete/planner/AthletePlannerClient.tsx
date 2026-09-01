'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
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
      setDraft((current) => ({
        ...current,
        templateId: null,
        scheduledDate: selectedDates[0] ?? initialDate,
      }));
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
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.4fr_0.8fr]">
      <Surface className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Week</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{periodLabel}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {editingSessionId ? 'Select one day to edit.' : 'Select one or more days.'}
          </p>
        </div>

        <div className="space-y-2">
          {days.map((day) => (
            <div
              key={day.isoDate}
              className={`block rounded-[12px] border p-3 transition ${
                selectedDates.includes(day.isoDate)
                  ? 'border-[#DCE0D2] bg-[var(--brand-tint)]'
                  : 'border-[var(--border)] bg-[#FBFAF7]'
              }`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedDates.includes(day.isoDate)}
                  disabled={editingSessionId !== null}
                  onChange={() => toggleDate(day.isoDate)}
                />
                <span>
                  <span className="block text-sm font-semibold text-[var(--text)]">{day.label}</span>
                  <span className="block text-xs text-[var(--text-secondary)]">{day.dateLabel}</span>
                </span>
                <Badge>{day.sessions.length}</Badge>
              </span>
              {day.sessions.length > 0 ? (
                <span className="mt-2 block space-y-1 pl-7">
                  {day.sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => loadSession(session)}
                      className={`${compactListButtonClassName} min-h-8 px-2 py-1 text-xs`}
                    >
                      {session.title}
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

      <Surface className="space-y-5">
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

      <Surface className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Save</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {selectedDates.length} day{selectedDates.length === 1 ? '' : 's'} selected.
          </p>
        </div>
        <button type="button" disabled={isPending} className={primaryButtonClassName} onClick={saveSession}>
          {isPending ? 'Saving...' : editingSessionId ? 'Save changes' : 'Save session'}
        </button>
        {editingSessionId ? (
          <button type="button" disabled={isPending} className={compactDangerButtonClassName} onClick={deleteSession}>
            Delete session
          </button>
        ) : null}
        {message ? <p className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}
        {templates.length === 0 ? (
          <EmptyState title="No templates yet" description="Create templates from the Templates menu." />
        ) : null}
      </Surface>
    </div>
  );
}
