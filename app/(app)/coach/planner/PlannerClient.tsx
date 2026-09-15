'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  ActionLink,
  Badge,
  compactDangerButtonClassName,
  compactListButtonClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  EmptyState,
  Surface,
  dangerTextClassName,
  formFieldClassName,
  formSelectClassName,
  primaryButtonClassName,
  successTextClassName,
} from '@/components/ui';
import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { ShareLinkButton } from '@/components/ShareLinkButton';
import { formatDuration } from '@/lib/format-duration';
import { deriveSessionEditorMetrics } from '@/lib/session-editor';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import {
  createEmptyPlannerEditorDraft,
  createPlannerEditorDraftFromPersisted,
  createPlannerEditorDraftFromTemplate,
  serializePlannerEditorDraftForSave,
  validatePlannerEditorDraft,
  type PlannerEditorDraft,
  type PlannerEditorTemplateRecord,
} from '@/lib/session-editor-adapters';
import { SourceAssignmentPanel } from './SourceAssignmentPanel';
import { parsePerformanceProfileJson } from '@/lib/performance-profile';

type PlannerAthlete = { id: number; name: string; email: string; performanceProfileJson?: string | null };
type PlannerSession = {
  id: number;
  athleteId: number | null;
  templateId: number | null;
  scheduledDate: string;
  sport: string;
  title: string;
  summary: string | null;
  status: string;
  source: string;
  adjusted: boolean;
  sportMetricsJson: string | null;
  durationSec: number;
  tss: number;
  segments: Array<{ key: string; zone: number; durationSec: number; label: string; color: string }>;
  blocks: PlannerEditorTemplateRecord['blocks'];
};
type PlannerLibrarySession = {
  id: number;
  coachOwnerId: number | null;
  sport: string;
  title: string;
  summary: string | null;
  date: string | null;
  planWeekday: number | null;
  sportMetricsJson: string | null;
  blocks: PlannerEditorTemplateRecord['blocks'];
};
type PlannerTrainingPlan = {
  id: number;
  name: string;
  sport: string;
  summary: string | null;
  sessions: PlannerLibrarySession[];
};
type PlannerDay = {
  isoDate: string;
  label: string;
  dateLabel: string;
  sessions: PlannerSession[];
};
type ApiPayload = { error?: string; sessionId?: number };

const workspaceModes = ['library', 'training-plan', 'athlete'] as const;
type WorkspaceMode = (typeof workspaceModes)[number];

const weekdayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function PlannerClient({
  athletes,
  templates,
  librarySessions,
  trainingPlans,
  days,
  periodLabel,
  initialAthleteId,
  initialTemplateId,
  initialDate,
  surface = 'all',
}: {
  athletes: PlannerAthlete[];
  templates: PlannerEditorTemplateRecord[];
  librarySessions: PlannerLibrarySession[];
  trainingPlans: PlannerTrainingPlan[];
  days: PlannerDay[];
  periodLabel: string;
  initialAthleteId: number | null;
  initialTemplateId: number | null;
  initialDate: string;
  surface?: 'all' | 'planner';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedWorkspaceMode, setSelectedWorkspaceMode] = useState<WorkspaceMode>(
    surface === 'planner' ? 'athlete' : athletes.length === 0 ? 'library' : 'athlete',
  );
  const [selectedAthleteId, setSelectedAthleteId] = useState<number | null>(initialAthleteId);
  const [selectedTrainingPlanId, setSelectedTrainingPlanId] = useState<number | null>(
    trainingPlans[0]?.id ?? null,
  );
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanSport, setNewPlanSport] = useState('RUNNING');
  const initialTemplate = templates.find((template) => template.id === initialTemplateId);
  const [draft, setDraft] = useState<PlannerEditorDraft>(() => {
    const ownershipMode = athletes.length === 0 ? 'coach-library' : 'athlete';
    return initialTemplate
      ? createPlannerEditorDraftFromTemplate(initialTemplate, {
          ownershipMode,
          athleteId: initialAthleteId,
          scheduledDate: initialDate,
        })
      : createEmptyPlannerEditorDraft({ ownershipMode, athleteId: initialAthleteId, scheduledDate: initialDate });
  });

  const visibleSessions = useMemo(
    () => days.flatMap((day) => day.sessions.filter((session) => session.athleteId === selectedAthleteId)),
    [days, selectedAthleteId],
  );
  const metrics = deriveSessionEditorMetrics(draft);
  const previewProfile = selectedWorkspaceMode === 'athlete'
    ? parsePerformanceProfileJson(athletes.find((athlete) => athlete.id === (draft.athleteId ?? selectedAthleteId))?.performanceProfileJson)
    : null;
  const selectedPlan = trainingPlans.find((p) => p.id === selectedTrainingPlanId);

  if (surface === 'planner' && athletes.length === 0) {
    return (
      <Surface className="space-y-4">
        <EmptyState
          title="Add an athlete before planning"
          description="Planner places workouts on an athlete's calendar. Add someone to your roster, then return here to schedule their work."
        />
        <ActionLink href="/coach" tone="secondary" size="compact">
          Open athletes
        </ActionLink>
      </Surface>
    );
  }

  function switchMode(mode: WorkspaceMode) {
    if (draft.id && !window.confirm('Switching workspace will reset the loaded draft. Continue?')) return;
    setSelectedWorkspaceMode(mode);
    setMessage('');
    const ownershipMode = mode === 'athlete' ? 'athlete' : mode === 'library' ? 'coach-library' : 'training-plan';
    setDraft(
      createEmptyPlannerEditorDraft({
        ownershipMode,
        athleteId: mode === 'athlete' ? selectedAthleteId : null,
        scheduledDate: mode === 'training-plan' ? null : initialDate,
      }),
    );
  }

  function startNewSession(isoDate: string) {
    setMessage('');
    const ownershipMode = selectedWorkspaceMode === 'athlete' ? 'athlete' : 'coach-library';
    setDraft(
      createEmptyPlannerEditorDraft({
        ownershipMode,
        athleteId: ownershipMode === 'athlete' ? selectedAthleteId : null,
        scheduledDate: isoDate,
      }),
    );
  }

  function startNewPlanSession() {
    setMessage('');
    setDraft(createEmptyPlannerEditorDraft({ ownershipMode: 'training-plan', athleteId: null, scheduledDate: null }));
  }

  function loadSession(session: PlannerSession) {
    setSelectedAthleteId(session.athleteId);
    setMessage('');
    setDraft(createPlannerEditorDraftFromPersisted({
      ...session,
      sourceTemplateId: session.templateId,
      ownershipMode: 'athlete',
    }));
  }

  function loadLibrarySession(session: PlannerLibrarySession) {
    setMessage('');
    setDraft(createPlannerEditorDraftFromPersisted({
      ...session,
      date: session.date,
      ownershipMode: 'coach-library',
      scheduledDate: session.date ?? initialDate,
    }));
  }

  function loadPlanSession(session: PlannerLibrarySession) {
    setMessage('');
    setDraft(createPlannerEditorDraftFromPersisted({
      ...session,
      ownershipMode: 'training-plan',
      scheduledDate: null,
      planWeekday: (session.planWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7) ?? null,
    }));
  }

  function loadTemplate(templateId: string) {
    const template = templates.find((item) => item.id === Number(templateId));
    if (!template) return;
    setMessage('');
    setDraft(
      createPlannerEditorDraftFromTemplate(template, {
        ownershipMode: draft.ownershipMode,
        athleteId: draft.ownershipMode === 'athlete' ? selectedAthleteId : null,
        scheduledDate: draft.scheduledDate,
      }),
    );
  }

  function saveSession() {
    if (isSaving) return;
    if (draft.ownershipMode === 'training-plan' && !selectedTrainingPlanId) {
      setMessageTone('danger');
      setMessage('No training plan selected. Choose or create a training plan first.');
      return;
    }
    const validationError = validatePlannerEditorDraft(draft);
    if (validationError) {
      setMessageTone('danger');
      setMessage(validationError);
      return;
    }

    setIsSaving(true);
    startTransition(() => { void saveDraft(); });
  }

  async function saveDraft() {
    const endpoint =
      draft.ownershipMode === 'coach-library'
        ? draft.id
          ? `/api/coach/planner/library-sessions/${draft.id}`
          : '/api/coach/planner/library-sessions'
        : draft.ownershipMode === 'training-plan' && selectedTrainingPlanId
          ? draft.id
            ? `/api/coach/planner/training-plans/${selectedTrainingPlanId}/sessions/${draft.id}`
            : `/api/coach/planner/training-plans/${selectedTrainingPlanId}/sessions`
          : draft.ownershipMode === 'athlete'
            ? draft.id
              ? `/api/coach/planner/sessions/${draft.id}`
              : '/api/coach/planner/sessions'
            : '/api/coach/planner/sessions';

    try {
      const response = await fetch(endpoint, {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializePlannerEditorDraftForSave(draft)),
      });
      const payload = await readApiPayload(response);
      if (!response.ok) {
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to save session');
        return;
      }
      setMessageTone('success');
      setMessage('Session saved.');
      router.refresh();
    } catch {
      setMessageTone('danger');
      setMessage('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function deleteSession() {
    const sessionId = draft.id;
    if (!sessionId) return;
    if (draft.ownershipMode === 'training-plan' && !selectedTrainingPlanId) {
      setMessageTone('danger');
      setMessage('No training plan selected. Choose a training plan first.');
      return;
    }
    if (!window.confirm('Delete this session? This cannot be undone.')) return;
    startTransition(() => {
      void deleteDraft(sessionId);
    });
  }

  async function deleteDraft(sessionId: number) {
    const deleteUrl =
      draft.ownershipMode === 'coach-library'
        ? `/api/coach/planner/library-sessions/${sessionId}`
        : draft.ownershipMode === 'training-plan' && selectedTrainingPlanId
          ? `/api/coach/planner/training-plans/${selectedTrainingPlanId}/sessions/${sessionId}`
          : `/api/coach/planner/sessions/${sessionId}`;

    try {
      const response = await fetch(deleteUrl, { method: 'DELETE' });
      const payload = await readApiPayload(response);
      if (!response.ok) {
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to delete session');
        return;
      }
      setMessageTone('success');
      setMessage('Session deleted.');
      setDraft(
        createEmptyPlannerEditorDraft({
          ownershipMode: draft.ownershipMode,
          athleteId: draft.ownershipMode === 'athlete' ? selectedAthleteId : null,
          scheduledDate: draft.ownershipMode === 'training-plan' ? null : draft.scheduledDate,
        }),
      );
      router.refresh();
    } catch {
      setMessageTone('danger');
      setMessage('Could not reach the server. Check your connection and try again.');
    }
  }

  async function createTrainingPlan() {
    const name = newPlanName.trim();
    if (!name) {
      setMessageTone('danger');
      setMessage('Training plan name is required.');
      return;
    }
    try {
      const response = await fetch('/api/coach/planner/training-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, sport: newPlanSport }),
      });
      const payload = (await response.json().catch(() => ({}))) as { planId?: number; error?: string };
      if (!response.ok) {
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to create training plan.');
        return;
      }
      setNewPlanName('');
      setShowCreatePlan(false);
      if (payload.planId) setSelectedTrainingPlanId(payload.planId);
      setMessageTone('success');
      setMessage('Training plan created.');
      router.refresh();
    } catch {
      setMessageTone('danger');
      setMessage('Could not reach the server. Check your connection and try again.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.35fr_0.9fr]">
      <Surface className="space-y-5">
        {/* Workspace mode switcher — retained for the compatibility workspace, not the focused Planner surface. */}
        {surface === 'all' ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Workspace</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={selectedWorkspaceMode === 'library' ? compactPrimaryButtonClassName : compactSecondaryButtonClassName}
                onClick={() => switchMode('library')}
              >
                Session library
              </button>
              <button
                type="button"
                className={selectedWorkspaceMode === 'training-plan' ? compactPrimaryButtonClassName : compactSecondaryButtonClassName}
                onClick={() => switchMode('training-plan')}
              >
                Training plans
              </button>
              {athletes.length > 0 ? (
                <button
                  type="button"
                  className={selectedWorkspaceMode === 'athlete' ? compactPrimaryButtonClassName : compactSecondaryButtonClassName}
                  onClick={() => switchMode('athlete')}
                >
                  Athlete week
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {selectedWorkspaceMode === 'athlete' ? 'Planner week' : 'Period'}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{periodLabel}</h2>
        </div>

        {/* Athlete selector — athlete mode only */}
        {selectedWorkspaceMode === 'athlete' && athletes.length > 0 ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Athlete</span>
            <select
              value={selectedAthleteId ?? ''}
              className={formSelectClassName}
              onChange={(event) => {
                const athleteId = Number(event.target.value);
                setSelectedAthleteId(athleteId);
                setDraft((current) => ({ ...current, athleteId }));
              }}
            >
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {/* Training plan controls */}
        {selectedWorkspaceMode === 'training-plan' ? (
          <div className="space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Training plan</span>
              <select
                className={formSelectClassName}
                value={selectedTrainingPlanId ?? ''}
               onChange={(event) => {
                 if (draft.id && !window.confirm('Changing plans will reset the loaded session draft. Continue?')) return;
                 setSelectedTrainingPlanId(Number(event.target.value) || null);
                  setDraft(createEmptyPlannerEditorDraft({ ownershipMode: 'training-plan', athleteId: null, scheduledDate: null }));
               }}
              >
                <option value="">Choose plan</option>
                {trainingPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={startNewPlanSession}
              className={`${compactSecondaryButtonClassName} w-full justify-start text-left`}
            >
              + New plan session
            </button>
            <div className="space-y-2">
              {(selectedPlan?.sessions ?? []).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => loadPlanSession(session)}
                  className={compactListButtonClassName}
                >
                  <span className="block truncate text-[13px] font-semibold text-[var(--text)]">
                    {session.planWeekday ? weekdayLabels[session.planWeekday - 1] : '?'}: {session.title}
                  </span>
                </button>
              ))}
            </div>
            {trainingPlans.length === 0 ? (
              <EmptyState
                title="No training plans yet"
                description="Create a plan, then add weekday sessions."
              />
            ) : null}
            {showCreatePlan ? (
              <div className="space-y-2 rounded-[12px] border border-[var(--border)] p-3">
                <p className="text-xs font-semibold text-[var(--text)]">New training plan</p>
                <input
                  className={formFieldClassName}
                  placeholder="Plan name"
                  value={newPlanName}
                  onChange={(event) => setNewPlanName(event.target.value)}
                />
                <select
                  className={formSelectClassName}
                  value={newPlanSport}
                  onChange={(event) => setNewPlanSport(event.target.value)}
                >
                  {SPORT_OPTIONS.map((sport) => (
                    <option key={sport} value={sport}>
                      {getSportLabel(sport)}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={compactPrimaryButtonClassName}
                    onClick={() => startTransition(() => { void createTrainingPlan(); })}
                    disabled={isPending}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    className={compactSecondaryButtonClassName}
                    onClick={() => { setShowCreatePlan(false); setNewPlanName(''); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreatePlan(true)}
                className={`${compactSecondaryButtonClassName} w-full justify-start text-left`}
              >
                + New training plan
              </button>
            )}
          </div>
        ) : null}

        {/* Calendar — athlete and library modes */}
        {selectedWorkspaceMode !== 'training-plan' ? (
          <div className="space-y-3">
            {days.map((day) => {
              const daySessions =
                selectedWorkspaceMode === 'athlete'
                  ? day.sessions.filter((session) => session.athleteId === selectedAthleteId)
                  : [];
              return (
                <div
                  key={day.isoDate}
                  className={`rounded-[12px] border p-4 transition ${
                    draft.scheduledDate === day.isoDate
                       ? 'border-[var(--field-selected-border)] bg-[var(--brand-tint)]'
                       : 'border-[var(--border)] bg-[var(--field-surface)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{day.label}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{day.dateLabel}</p>
                    </div>
                    {selectedWorkspaceMode === 'athlete' ? <Badge>{daySessions.length}</Badge> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => startNewSession(day.isoDate)}
                    className={`${compactSecondaryButtonClassName} mt-3 w-full justify-start text-left`}
                  >
                    Plan here
                  </button>
                  {selectedWorkspaceMode === 'athlete' ? (
                    <div className="mt-3 space-y-2">
                       {daySessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => loadSession(session)}
                          className={compactListButtonClassName}
                        >
                          <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{session.title}</span>
                          <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">
                            {formatDuration(session.durationSec)} · {session.tss} TSS
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Library sessions list — library mode only */}
        {selectedWorkspaceMode === 'library' && librarySessions.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Saved library sessions
            </p>
            {librarySessions.map((session) => (
              <div key={session.id} className="space-y-2 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] p-2">
                <button
                  type="button"
                  onClick={() => loadLibrarySession(session)}
                  className={compactListButtonClassName}
                >
                  <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{session.title}</span>
                  <span className="mt-1 block text-[12px] text-[var(--text-secondary)]">{getSportLabel(session.sport)}</span>
                </button>
                <ShareLinkButton sourceKind="session" sourceId={session.id} />
              </div>
            ))}
          </div>
        ) : null}
        <SourceAssignmentPanel
          athletes={athletes}
          templates={templates}
          librarySessions={librarySessions}
          trainingPlans={trainingPlans}
           initialDate={initialDate}
           selectedAthleteId={selectedAthleteId}
           onAthleteChange={setSelectedAthleteId}
         />
      </Surface>

      <Surface className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Session canvas
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">
              {draft.id ? 'Edit planned session' : 'Create detailed session'}
            </h2>
          </div>
          <Badge tone="brand">
            {formatDuration(metrics.durationSec)} · {metrics.tss} TSS
          </Badge>
        </div>

        {/* Weekday selector — training-plan mode only */}
        {draft.ownershipMode === 'training-plan' ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Weekday</span>
            <select
              className={formSelectClassName}
              value={draft.planWeekday ?? ''}
              onChange={(event) => {
                const val = Number(event.target.value);
                setDraft((current) => ({
                  ...current,
                  planWeekday: val >= 1 && val <= 7 ? (val as 1 | 2 | 3 | 4 | 5 | 6 | 7) : null,
                  scheduledDate: null,
                }));
              }}
            >
              <option value="">Choose weekday</option>
              {weekdayLabels.map((label, idx) => (
                <option key={label} value={idx + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <WorkoutBuilder
          draft={draft}
          onChange={(next) =>
            setDraft((current) => ({
              ...next,
              ownershipMode: current.ownershipMode,
              sourceTemplateId: current.sourceTemplateId,
            }))
          }
          showSportMetrics
          summaryPlaceholder="Coach notes or session intent"
          durationUnit="minutes"
          performanceProfile={previewProfile}
          profileLabel="selected athlete's current profile"
        />
      </Surface>

      <Surface className="space-y-5">
        {templates.length > 0 ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Prefill from template</span>
            <select className={formSelectClassName} value={draft.sourceTemplateId ?? ''} onChange={(event) => loadTemplate(event.target.value)}>
              <option value="">Choose template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <EmptyState
            title="No templates yet"
            description="Create a session to get started."
          />
        )}

        <div className="flex flex-col gap-3">
           <button type="button" disabled={isPending || isSaving} className={primaryButtonClassName} onClick={saveSession}>
             {isPending || isSaving ? 'Saving…' : 'Save session'}
          </button>
          {draft.id ? (
            <button type="button" disabled={isPending} className={compactDangerButtonClassName} onClick={deleteSession}>
              Delete session
            </button>
          ) : null}
          {message ? (
             <p role={messageTone === 'success' ? 'status' : 'alert'} aria-live="polite" className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p>
          ) : null}
        </div>

        <div className="rounded-[12px] bg-[var(--field-surface)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">Week context</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {selectedWorkspaceMode === 'athlete'
              ? `${visibleSessions.length} sessions currently planned for this athlete.`
              : selectedWorkspaceMode === 'library'
                ? `${librarySessions.length} standalone coach sessions in library.`
                : `${selectedPlan?.sessions.length ?? 0} sessions in this training plan.`}
          </p>
        </div>
      </Surface>
    </div>
  );
}

async function readApiPayload(response: Response): Promise<ApiPayload> {
  const payload: unknown = await response.json().catch(() => ({}));
  if (!payload || typeof payload !== 'object') return {};
  const record = payload as Record<string, unknown>;
  return {
    error: typeof record.error === 'string' ? record.error : undefined,
    sessionId: typeof record.sessionId === 'number' ? record.sessionId : undefined,
  };
}
