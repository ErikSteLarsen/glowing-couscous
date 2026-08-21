'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import {
  Badge,
  EmptyState,
  Surface,
  dangerTextClassName,
  formFieldClassName,
  formSelectClassName,
  formTextareaClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
} from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { formatDuration } from '@/lib/format-duration';
import { deriveSessionMetrics } from '@/lib/session-math';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import { TEMPO_ZONE_META, type TempoBlockKind, type TempoZone } from '@/lib/tempo-blocks';
import {
  addPlannerBlock,
  createEmptyPlannerSessionDraft,
  createPlannerBlockDraft,
  duplicatePlannerBlock,
  movePlannerBlock,
  parseSportMetricsJson,
  plannerDraftToTempoBlocks,
  removePlannerBlock,
  serializePlannerDraftForSave,
  templateToPlannerDraft,
  updatePlannerBlock,
  validatePlannerSessionDraft,
  type PlannerSessionDraft,
  type PlannerSportMetrics,
  type PlannerTargetType,
  type PlannerTemplateRecord,
} from '@/lib/planner-draft';
import { SourceAssignmentPanel } from './SourceAssignmentPanel';

type PlannerAthlete = { id: number; name: string; email: string };
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
  blocks: PlannerTemplateRecord['blocks'];
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
  blocks: PlannerTemplateRecord['blocks'];
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

const blockKinds = ['warmup', 'work', 'recovery', 'cooldown'] as const;
const targetTypes = ['power', 'pace', 'hr'] as const;
const weekdayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptySportMetrics: PlannerSportMetrics = { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null };

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
}: {
  athletes: PlannerAthlete[];
  templates: PlannerTemplateRecord[];
  librarySessions: PlannerLibrarySession[];
  trainingPlans: PlannerTrainingPlan[];
  days: PlannerDay[];
  periodLabel: string;
  initialAthleteId: number | null;
  initialTemplateId: number | null;
  initialDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedWorkspaceMode, setSelectedWorkspaceMode] = useState<WorkspaceMode>(
    athletes.length === 0 ? 'library' : 'athlete',
  );
  const [selectedAthleteId, setSelectedAthleteId] = useState<number | null>(initialAthleteId);
  const [selectedTrainingPlanId, setSelectedTrainingPlanId] = useState<number | null>(
    trainingPlans[0]?.id ?? null,
  );
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanSport, setNewPlanSport] = useState('RUNNING');
  const initialTemplate = templates.find((template) => template.id === initialTemplateId);
  const [draft, setDraft] = useState<PlannerSessionDraft>(() => {
    const ownershipMode = athletes.length === 0 ? 'coach-library' : 'athlete';
    return initialTemplate
      ? templateToPlannerDraft(initialTemplate, {
          ownershipMode,
          athleteId: initialAthleteId,
          scheduledDate: initialDate,
        })
      : createEmptyPlannerSessionDraft({ ownershipMode, athleteId: initialAthleteId, scheduledDate: initialDate });
  });

  const visibleSessions = useMemo(
    () => days.flatMap((day) => day.sessions.filter((session) => session.athleteId === selectedAthleteId)),
    [days, selectedAthleteId],
  );
  const metrics = deriveSessionMetrics(plannerDraftToTempoBlocks(draft.blocks));
  const selectedBlock = draft.blocks[selectedBlockIndex] ?? draft.blocks[0];
  const selectedPlan = trainingPlans.find((p) => p.id === selectedTrainingPlanId);

  function switchMode(mode: WorkspaceMode) {
    if (draft.id && !window.confirm('Switching workspace will reset the loaded draft. Continue?')) return;
    setSelectedWorkspaceMode(mode);
    setSelectedBlockIndex(0);
    setMessage('');
    const ownershipMode = mode === 'athlete' ? 'athlete' : mode === 'library' ? 'coach-library' : 'training-plan';
    setDraft(
      createEmptyPlannerSessionDraft({
        ownershipMode,
        athleteId: mode === 'athlete' ? selectedAthleteId : null,
        scheduledDate: mode === 'training-plan' ? null : initialDate,
      }),
    );
  }

  function startNewSession(isoDate: string) {
    setSelectedBlockIndex(0);
    setMessage('');
    const ownershipMode = selectedWorkspaceMode === 'athlete' ? 'athlete' : 'coach-library';
    setDraft(
      createEmptyPlannerSessionDraft({
        ownershipMode,
        athleteId: ownershipMode === 'athlete' ? selectedAthleteId : null,
        scheduledDate: isoDate,
      }),
    );
  }

  function startNewPlanSession() {
    setSelectedBlockIndex(0);
    setMessage('');
    setDraft(
      createEmptyPlannerSessionDraft({ ownershipMode: 'training-plan', athleteId: null, scheduledDate: null }),
    );
  }

  function loadSession(session: PlannerSession) {
    setSelectedAthleteId(session.athleteId);
    setSelectedBlockIndex(0);
    setMessage('');
    setDraft({
      id: session.id,
      ownershipMode: 'athlete',
      athleteId: session.athleteId,
      scheduledDate: session.scheduledDate,
      planWeekday: null,
      sport: session.sport,
      title: session.title,
      summary: session.summary ?? '',
      sourceTemplateId: session.templateId,
      sportMetrics: parseSportMetricsJson(session.sportMetricsJson),
      blocks: session.blocks.map((block) =>
        createPlannerBlockDraft({
          clientId: `session-${session.id}-block-${block.id}`,
          id: block.id,
          kind: parseBlockKind(block.kind) ?? 'work',
          zone: parseTempoZone(String(block.zone)),
          durationSec: block.durationSec,
          reps: block.reps,
          targetType: parseTargetType(block.targetType ?? ''),
          targetLow: block.targetLow,
          targetHigh: block.targetHigh,
          note: block.note ?? '',
        }),
      ),
    });
  }

  function loadLibrarySession(session: PlannerLibrarySession) {
    setSelectedBlockIndex(0);
    setMessage('');
    setDraft({
      id: session.id,
      ownershipMode: 'coach-library',
      athleteId: null,
      scheduledDate: session.date ?? initialDate,
      planWeekday: null,
      sport: session.sport,
      title: session.title,
      summary: session.summary ?? '',
      sourceTemplateId: null,
      sportMetrics: parseSportMetricsJson(session.sportMetricsJson),
      blocks: session.blocks.map((block) =>
        createPlannerBlockDraft({
          clientId: `lib-${session.id}-block-${block.id}`,
          id: block.id,
          kind: parseBlockKind(block.kind) ?? 'work',
          zone: parseTempoZone(String(block.zone)),
          durationSec: block.durationSec,
          reps: block.reps,
          targetType: parseTargetType(block.targetType ?? ''),
          targetLow: block.targetLow,
          targetHigh: block.targetHigh,
          note: block.note ?? '',
        }),
      ),
    });
  }

  function loadPlanSession(session: PlannerLibrarySession) {
    setSelectedBlockIndex(0);
    setMessage('');
    setDraft({
      id: session.id,
      ownershipMode: 'training-plan',
      athleteId: null,
      scheduledDate: null,
      planWeekday: (session.planWeekday as 1 | 2 | 3 | 4 | 5 | 6 | 7) ?? null,
      sport: session.sport,
      title: session.title,
      summary: session.summary ?? '',
      sourceTemplateId: null,
      sportMetrics: parseSportMetricsJson(session.sportMetricsJson),
      blocks: session.blocks.map((block) =>
        createPlannerBlockDraft({
          clientId: `plan-${session.id}-block-${block.id}`,
          id: block.id,
          kind: parseBlockKind(block.kind) ?? 'work',
          zone: parseTempoZone(String(block.zone)),
          durationSec: block.durationSec,
          reps: block.reps,
          targetType: parseTargetType(block.targetType ?? ''),
          targetLow: block.targetLow,
          targetHigh: block.targetHigh,
          note: block.note ?? '',
        }),
      ),
    });
  }

  function loadTemplate(templateId: string) {
    const template = templates.find((item) => item.id === Number(templateId));
    if (!template) return;
    setSelectedBlockIndex(0);
    setMessage('');
    setDraft(
      templateToPlannerDraft(template, {
        ownershipMode: draft.ownershipMode,
        athleteId: draft.ownershipMode === 'athlete' ? selectedAthleteId : null,
        scheduledDate: draft.scheduledDate,
      }),
    );
  }

  function saveSession() {
    if (draft.ownershipMode === 'training-plan' && !selectedTrainingPlanId) {
      setMessageTone('danger');
      setMessage('No training plan selected. Choose or create a training plan first.');
      return;
    }
    const validationError = validatePlannerSessionDraft(draft);
    if (validationError) {
      setMessageTone('danger');
      setMessage(validationError);
      return;
    }

    startTransition(() => {
      void saveDraft();
    });
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

    const response = await fetch(endpoint, {
      method: draft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializePlannerDraftForSave(draft)),
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
  }

  function deleteSession() {
    const sessionId = draft.id;
    if (!sessionId) return;
    if (draft.ownershipMode === 'training-plan' && !selectedTrainingPlanId) {
      setMessageTone('danger');
      setMessage('No training plan selected. Choose a training plan first.');
      return;
    }
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
      createEmptyPlannerSessionDraft({
        ownershipMode: draft.ownershipMode,
        athleteId: draft.ownershipMode === 'athlete' ? selectedAthleteId : null,
        scheduledDate: draft.ownershipMode === 'training-plan' ? null : draft.scheduledDate,
      }),
    );
    router.refresh();
  }

  async function createTrainingPlan() {
    const name = newPlanName.trim();
    if (!name) {
      setMessageTone('danger');
      setMessage('Training plan name is required.');
      return;
    }
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
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.35fr_0.9fr]">
      <Surface className="space-y-5">
        {/* Workspace mode switcher */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Workspace</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={selectedWorkspaceMode === 'library' ? primaryButtonClassName : secondaryButtonClassName}
              onClick={() => switchMode('library')}
            >
              Session library
            </button>
            <button
              type="button"
              className={selectedWorkspaceMode === 'training-plan' ? primaryButtonClassName : secondaryButtonClassName}
              onClick={() => switchMode('training-plan')}
            >
              Training plans
            </button>
            {athletes.length > 0 ? (
              <button
                type="button"
                className={selectedWorkspaceMode === 'athlete' ? primaryButtonClassName : secondaryButtonClassName}
                onClick={() => switchMode('athlete')}
              >
                Athlete week
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {selectedWorkspaceMode === 'athlete' ? 'Planner week' : 'Period'}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{periodLabel}</h2>
          {selectedWorkspaceMode !== 'training-plan' ? (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Click a day to plan or open an existing session.</p>
          ) : null}
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
                 setDraft(createEmptyPlannerSessionDraft({ ownershipMode: 'training-plan', athleteId: null, scheduledDate: null }));
                 setSelectedBlockIndex(0);
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
              className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--field-surface)]"
            >
              + New plan session
            </button>
            <div className="space-y-2">
              {(selectedPlan?.sessions ?? []).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => loadPlanSession(session)}
                  className="block w-full rounded-[10px] bg-[var(--surface)] px-3 py-2 text-left transition hover:bg-[var(--field-surface)]"
                >
                  <span className="block truncate text-xs font-semibold text-[var(--text)]">
                    {session.planWeekday ? weekdayLabels[session.planWeekday - 1] : '?'}: {session.title}
                  </span>
                </button>
              ))}
            </div>
            {trainingPlans.length === 0 ? (
              <EmptyState
                title="No training plans yet"
                description="Create a training plan below, then add weekday sessions here."
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
                    className={primaryButtonClassName}
                    onClick={() => startTransition(() => { void createTrainingPlan(); })}
                    disabled={isPending}
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
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
                className="w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--field-surface)]"
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
                      ? 'border-[#DCE0D2] bg-[var(--brand-tint)]'
                      : 'border-[var(--border)] bg-[#FBFAF7]'
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
                    className="mt-3 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-xs font-semibold text-[var(--text)] transition hover:bg-[var(--field-surface)]"
                  >
                    Plan here
                  </button>
                  {selectedWorkspaceMode === 'athlete' ? (
                    <div className="mt-3 space-y-2">
                      {daySessions.slice(0, 2).map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => loadSession(session)}
                          className="block w-full rounded-[10px] bg-[var(--surface)] px-3 py-2 text-left transition hover:bg-[var(--field-surface)]"
                        >
                          <span className="block truncate text-xs font-semibold text-[var(--text)]">{session.title}</span>
                          <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">
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
              <button
                key={session.id}
                type="button"
                onClick={() => loadLibrarySession(session)}
                className="block w-full rounded-[10px] bg-[var(--surface)] px-3 py-2 text-left transition hover:bg-[var(--field-surface)]"
              >
                <span className="block truncate text-xs font-semibold text-[var(--text)]">{session.title}</span>
                <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">{getSportLabel(session.sport)}</span>
              </button>
            ))}
          </div>
        ) : null}
        <SourceAssignmentPanel
          athletes={athletes}
          templates={templates}
          librarySessions={librarySessions}
          trainingPlans={trainingPlans}
          initialDate={initialDate}
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

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={formFieldClassName}
            value={draft.title}
            placeholder="Session title"
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
          <select
            className={formSelectClassName}
            value={draft.sport}
            onChange={(event) => setDraft({ ...draft, sport: event.target.value })}
          >
            {SPORT_OPTIONS.map((sport) => (
              <option key={sport} value={sport}>
                {getSportLabel(sport)}
              </option>
            ))}
          </select>
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

        <textarea
          className={formTextareaClassName}
          value={draft.summary}
          placeholder="Coach notes or session intent"
          onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
        />

        <SessionBlockBar segments={metrics.segments} />

        <div className="space-y-3">
          {draft.blocks.map((block, index) => {
            const zoneMeta = TEMPO_ZONE_META[block.zone];
            return (
              <button
                key={block.clientId}
                type="button"
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                  setDraft((current) => movePlannerBlock(current, fromIndex, index));
                  setSelectedBlockIndex(index);
                }}
                onClick={() => setSelectedBlockIndex(index)}
                className={`w-full rounded-[12px] border p-4 text-left transition ${
                  selectedBlockIndex === index
                    ? 'border-[#DCE0D2] bg-[var(--brand-tint)]'
                    : 'border-[var(--border)] bg-[#FBFAF7]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-[var(--text)]">{block.kind}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{block.note || zoneMeta.name}</p>
                  </div>
                  <MetricText>{formatDuration(block.durationSec)}</MetricText>
                </div>
                <div
                  className="mt-3 h-2 rounded-full"
                  style={{
                    background: zoneMeta.solid,
                    width: `${Math.max(18, Math.min(100, (block.durationSec / Math.max(metrics.durationSec, 1)) * 100))}%`,
                  }}
                />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          {blockKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              className={secondaryButtonClassName}
              onClick={() => setDraft((current) => addPlannerBlock(current, kind))}
            >
              Add {kind}
            </button>
          ))}
        </div>
      </Surface>

      <Surface className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Inspector</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Tune selected block</h2>
        </div>

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
            description="Create detailed sessions from scratch now; template creation can reuse this editor later."
          />
        )}

        {selectedBlock ? (
          <div className="space-y-4">
            <select
              className={formSelectClassName}
              value={selectedBlock.kind}
              onChange={(event) => {
                const kind = parseBlockKind(event.target.value);
                if (kind) setDraft((current) => updatePlannerBlock(current, selectedBlockIndex, { kind }));
              }}
            >
              {blockKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Duration (minutes)</span>
              <input
                className={formFieldClassName}
                type="number"
                min="1"
                value={Math.round(selectedBlock.durationSec / 60)}
                onChange={(event) =>
                  setDraft((current) =>
                    updatePlannerBlock(current, selectedBlockIndex, { durationSec: Number(event.target.value) * 60 }),
                  )
                }
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Intensity zone</span>
              <input
                className={formFieldClassName}
                type="range"
                min="1"
                max="5"
                value={selectedBlock.zone}
                onChange={(event) => {
                  const zone = parseTempoZone(event.target.value);
                  setDraft((current) => updatePlannerBlock(current, selectedBlockIndex, { zone }));
                }}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Target type</span>
              <select
                className={formSelectClassName}
                value={selectedBlock.targetType ?? ''}
                onChange={(event) =>
                  setDraft((current) =>
                    updatePlannerBlock(current, selectedBlockIndex, { targetType: parseTargetType(event.target.value) }),
                  )
                }
              >
                <option value="">No target</option>
                {targetTypes.map((targetType) => (
                  <option key={targetType} value={targetType}>
                    {targetType}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                className={formFieldClassName}
                type="number"
                min="0"
                placeholder="Target low"
                value={selectedBlock.targetLow ?? ''}
                onChange={(event) =>
                  setDraft((current) =>
                    updatePlannerBlock(current, selectedBlockIndex, {
                      targetLow: parseNullableNumber(event.target.value),
                    }),
                  )
                }
              />
              <input
                className={formFieldClassName}
                type="number"
                min="0"
                placeholder="Target high"
                value={selectedBlock.targetHigh ?? ''}
                onChange={(event) =>
                  setDraft((current) =>
                    updatePlannerBlock(current, selectedBlockIndex, {
                      targetHigh: parseNullableNumber(event.target.value),
                    }),
                  )
                }
              />
            </div>
            <textarea
              className={formTextareaClassName}
              value={selectedBlock.note}
              placeholder="Block cue or instructions"
              onChange={(event) =>
                setDraft((current) => updatePlannerBlock(current, selectedBlockIndex, { note: event.target.value }))
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => setDraft((current) => duplicatePlannerBlock(current, selectedBlockIndex))}
              >
                Copy block
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  setDraft((current) => removePlannerBlock(current, selectedBlockIndex));
                  setSelectedBlockIndex((current) => Math.max(0, current - 1));
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ) : null}

        {/* Sport metrics */}
        <div className="space-y-3 rounded-[12px] border border-[var(--border)] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">Sport metrics</p>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">FTP (watts)</span>
            <input
              className={formFieldClassName}
              type="number"
              min="0"
              placeholder="e.g. 280"
              value={draft.sportMetrics.ftp ?? ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sportMetrics: { ...current.sportMetrics, ftp: parseNullableNumber(event.target.value) },
                }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">Threshold pace (sec/km)</span>
            <input
              className={formFieldClassName}
              type="number"
              min="0"
              placeholder="e.g. 255"
              value={draft.sportMetrics.thresholdPaceSecPerKm ?? ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sportMetrics: {
                    ...current.sportMetrics,
                    thresholdPaceSecPerKm: parseNullableNumber(event.target.value),
                  },
                }))
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">Threshold HR (bpm)</span>
            <input
              className={formFieldClassName}
              type="number"
              min="0"
              placeholder="e.g. 172"
              value={draft.sportMetrics.thresholdHr ?? ''}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sportMetrics: { ...current.sportMetrics, thresholdHr: parseNullableNumber(event.target.value) },
                }))
              }
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <button type="button" disabled={isPending} className={primaryButtonClassName} onClick={saveSession}>
            Save session
          </button>
          {draft.id ? (
            <button type="button" disabled={isPending} className={secondaryButtonClassName} onClick={deleteSession}>
              Delete session
            </button>
          ) : null}
          {message ? (
            <p className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p>
          ) : null}
        </div>

        <div className="rounded-[12px] bg-[#FBFAF7] p-4">
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

function parseBlockKind(input: string): TempoBlockKind | null {
  return blockKinds.includes(input as TempoBlockKind) ? (input as TempoBlockKind) : null;
}

function parseTempoZone(input: string): TempoZone {
  const parsed = Number(input);
  return parsed >= 1 && parsed <= 5 ? (Math.round(parsed) as TempoZone) : 2;
}

function parseTargetType(input: string): PlannerTargetType | null {
  return targetTypes.includes(input as PlannerTargetType) ? (input as PlannerTargetType) : null;
}

function parseNullableNumber(input: string) {
  if (input === '') return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : null;
}
