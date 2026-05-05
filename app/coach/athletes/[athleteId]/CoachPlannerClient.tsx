'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { CoachEditorDrawer } from '@/components/CoachEditorDrawer';
import { WorkoutBlocksEditor } from '@/components/WorkoutBlocksEditor';
import { SessionCard } from '@/components/session-card';
import { Badge } from '@/components/ui';
import { WeekStrip } from '@/components/week-strip';
import { createEmptySessionDraft, SessionDraft, SPORT_OPTIONS, templateToDraft } from '@/lib/planner';
import { createWorkoutContentDraftFromRecord } from '@/lib/workout-editor';
import { addWorkoutBlock, mapWorkoutBlockRecordsToDraft, removeWorkoutBlock, updateWorkoutBlock } from '@/lib/workout-spec';

type SessionRecord = {
  id: number;
  scheduledDate: string;
  sportType: string;
  title: string;
  summary: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  intensity: string | null;
  sourceTemplateId: number | null;
  blocks: Array<{
    id: number;
    blockType: string;
    title: string;
    instructions: string | null;
    sortOrder: number;
  }>;
  completion: {
    isDone: boolean;
    notes: string | null;
    completedAt: string | null;
  } | null;
};

type TemplateRecord = {
  id: number;
  sportType: string;
  name: string;
  summary: string | null;
  blocks: Array<{
    id: number;
    blockType: string;
    title: string;
    instructions: string | null;
    sortOrder: number;
  }>;
};

type CoachPlannerClientProps = {
  athleteId: number;
  athleteName: string;
  coachName: string;
  weekStart: string;
  weeklyNote: string;
  sessions: SessionRecord[];
  templates: TemplateRecord[];
  previousSessions: SessionRecord[];
};

export function CoachPlannerClient({
  athleteId,
  athleteName,
  coachName,
  weekStart,
  weeklyNote,
  sessions,
  templates,
  previousSessions,
}: CoachPlannerClientProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(weekStart);
  const [isPending, startTransition] = useTransition();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [draft, setDraft] = useState<SessionDraft>(() => createEmptySessionDraft(weekStart));
  const [errorMessage, setErrorMessage] = useState('');
  const [weeklyNoteValue, setWeeklyNoteValue] = useState(weeklyNote);

  const weekDays = useMemo(() => {
    const base = startOfWeek(parseISO(weekStart), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(base, index);
      const isoDate = format(date, 'yyyy-MM-dd');
      const daySessions = sessions.filter((session) => format(parseISO(session.scheduledDate), 'yyyy-MM-dd') === isoDate);
      return {
        date,
        isoDate,
        shortLabel: format(date, 'EEE'),
        dayNumber: format(date, 'd'),
        fullLabel: format(date, 'EEEE d MMM'),
        sessions: daySessions,
      };
    });
  }, [sessions, weekStart]);

  const selectedDay = weekDays.find((day) => day.isoDate === selectedDate) ?? weekDays[0];
  const selectedIndex = weekDays.findIndex((day) => day.isoDate === selectedDay.isoDate);

  function openCreateDrawer(prefill?: SessionDraft) {
    setMode('create');
    setEditingSessionId(null);
    setDraft(prefill ?? createEmptySessionDraft(selectedDay.isoDate));
    setErrorMessage('');
    setIsDrawerOpen(true);
  }

  function openEditDrawer(session: SessionRecord) {
    const content = createWorkoutContentDraftFromRecord({
      sportType: session.sportType,
      summary: session.summary,
      blocks: session.blocks,
    });

    setMode('edit');
    setEditingSessionId(session.id);
    setDraft({
      scheduledDate: format(parseISO(session.scheduledDate), 'yyyy-MM-dd'),
      title: session.title,
      durationMinutes: session.durationMinutes,
      distanceKm: session.distanceKm,
      intensity: session.intensity ?? '',
      sourceTemplateId: session.sourceTemplateId,
      sportType: content.sportType,
      summary: content.summary,
      blocks: content.blocks,
    });
    setErrorMessage('');
    setIsDrawerOpen(true);
  }

  function updateDraft<K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateBlock(index: number, key: 'blockType' | 'title' | 'instructions', value: string) {
    setDraft((current) => ({ ...current, blocks: updateWorkoutBlock(current.blocks, index, key, value) }));
  }

  function addBlock() {
    setDraft((current) => ({ ...current, blocks: addWorkoutBlock(current.blocks) }));
  }

  function removeBlock(index: number) {
    setDraft((current) => ({ ...current, blocks: removeWorkoutBlock(current.blocks, index) }));
  }

  async function submitDraft() {
    setErrorMessage('');
    const url =
      mode === 'create'
        ? `/api/coach/athletes/${athleteId}/planner/weeks/${weekStart}/sessions`
        : `/api/coach/sessions/${editingSessionId}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    startTransition(async () => {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to save session' }));
        setErrorMessage(payload.error ?? 'Failed to save session');
        return;
      }

      setIsDrawerOpen(false);
      router.refresh();
    });
  }

  async function deleteSession(sessionId: number) {
    startTransition(async () => {
      const response = await fetch(`/api/coach/sessions/${sessionId}`, { method: 'DELETE' });
      if (!response.ok) {
        setErrorMessage('Failed to delete session');
        return;
      }
      setIsDrawerOpen(false);
      router.refresh();
    });
  }

  async function saveWeeklyNote() {
    startTransition(async () => {
      const response = await fetch(`/api/coach/athletes/${athleteId}/planner/weeks/${weekStart}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weeklyNote: weeklyNoteValue }),
      });

      if (!response.ok) {
        setErrorMessage('Failed to save weekly note');
        return;
      }

      router.refresh();
    });
  }

  async function copyPreviousWeek() {
    setErrorMessage('');
    startTransition(async () => {
      const response = await fetch(`/api/coach/athletes/${athleteId}/planner/weeks/${weekStart}/copy-previous`, {
        method: 'POST',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to copy previous week' }));
        setErrorMessage(payload.error ?? 'Failed to copy previous week');
        return;
      }

      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-[rgba(17,24,39,0.78)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Current week</p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {format(parseISO(weekStart), 'd MMM')} to {format(addDays(parseISO(weekStart), 6), 'd MMM yyyy')}
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Hybrid planner for {athleteName}. Coach: {coachName}.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">Tap/click add first</Badge>
              <Badge>Manual week copy</Badge>
              <Badge>Template prefills</Badge>
            </div>
          </div>

          <div className="mt-5">
            <WeekStrip days={weekDays} selectedIndex={selectedIndex} />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[rgba(17,24,39,0.78)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Weekly note</p>
          <textarea
            value={weeklyNoteValue}
            onChange={(event) => setWeeklyNoteValue(event.target.value)}
            className="mt-4 min-h-32 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white outline-none transition focus:border-[rgba(90,124,255,0.45)]"
            placeholder="Add the coach note for this week"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={saveWeeklyNote}
              className="rounded-2xl bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white"
              disabled={isPending}
            >
              Save note
            </button>
            <button
              type="button"
              onClick={copyPreviousWeek}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200"
              disabled={isPending}
            >
              Copy previous week
            </button>
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-amber-300">{errorMessage}</p> : null}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-[rgba(17,24,39,0.78)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Selected day</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{selectedDay.fullLabel}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day) => (
                <button
                  key={day.isoDate}
                  type="button"
                  onClick={() => setSelectedDate(day.isoDate)}
                  className={`rounded-2xl px-3 py-2 text-sm font-medium ${selectedDate === day.isoDate ? 'bg-[rgba(90,124,255,0.18)] text-white' : 'bg-white/5 text-slate-200'}`}
                >
                  {day.shortLabel}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {selectedDay.sessions.length > 0 ? (
              selectedDay.sessions.map((session) => (
                <div key={session.id} className="space-y-3">
                  <SessionCard
                    session={{
                      ...session,
                      scheduledDate: parseISO(session.scheduledDate),
                      blocks: session.blocks,
                      completion: session.completion
                        ? {
                            ...session.completion,
                            completedAt: session.completion.completedAt ? parseISO(session.completion.completedAt) : null,
                          }
                        : null,
                    }}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openEditDrawer(session)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200"
                    >
                      Edit session
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openCreateDrawer({
                          ...createEmptySessionDraft(selectedDay.isoDate),
                          scheduledDate: selectedDay.isoDate,
                          sportType: session.sportType,
                          title: `${session.title} copy`,
                          summary: session.summary ?? '',
                          durationMinutes: session.durationMinutes,
                          distanceKm: session.distanceKm,
                          intensity: session.intensity ?? '',
                          sourceTemplateId: session.sourceTemplateId,
                          blocks: mapWorkoutBlockRecordsToDraft(session.blocks),
                        })
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200"
                    >
                      Duplicate to day
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-sm text-slate-300">
                No sessions planned for this day yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[rgba(17,24,39,0.78)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Planner actions</p>
          <div className="mt-4 space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-semibold text-white">Create from scratch</p>
              <button
                type="button"
                onClick={() => openCreateDrawer()}
                className="mt-3 rounded-2xl bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white"
              >
                Add session to {format(parseISO(selectedDay.isoDate), 'EEE d MMM')}
              </button>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-semibold text-white">Create from template</p>
              <div className="mt-3 space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => openCreateDrawer(templateToDraft(template, selectedDay.isoDate))}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-left"
                  >
                    <span>
                      <span className="block font-medium text-white">{template.name}</span>
                      <span className="mt-1 block text-xs text-slate-400">{template.blocks.length} blocks</span>
                    </span>
                    <span className="text-xs text-slate-300">{template.sportType}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 p-4">
              <p className="font-semibold text-white">Create from previous week</p>
              <div className="mt-3 space-y-2">
                {previousSessions.length > 0 ? (
                  previousSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() =>
                        openCreateDrawer({
                          scheduledDate: selectedDay.isoDate,
                          sportType: session.sportType,
                          title: session.title,
                          summary: session.summary ?? '',
                          durationMinutes: session.durationMinutes,
                          distanceKm: session.distanceKm,
                          intensity: session.intensity ?? '',
                          sourceTemplateId: session.sourceTemplateId,
                          blocks: mapWorkoutBlockRecordsToDraft(session.blocks),
                        })
                      }
                      className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-3 py-3 text-left"
                    >
                      <span>
                        <span className="block font-medium text-white">{session.title}</span>
                        <span className="mt-1 block text-xs text-slate-400">{format(parseISO(session.scheduledDate), 'EEE d MMM')}</span>
                      </span>
                      <span className="text-xs text-slate-300">{session.sportType}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No previous-week sessions available to prefill from.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <CoachEditorDrawer
        isOpen={isDrawerOpen}
        eyebrow="Session editor"
        title={mode === 'create' ? 'Create session' : 'Edit session'}
        description="All create and edit paths use the same draft form so templates and copied sessions stay editable before save."
        onClose={() => setIsDrawerOpen(false)}
        actions={
          <>
            <button type="button" onClick={submitDraft} className="rounded-2xl bg-[var(--brand-strong)] px-4 py-2 text-sm font-semibold text-white" disabled={isPending}>
              {mode === 'create' ? 'Create session' : 'Save changes'}
            </button>
            {mode === 'edit' && editingSessionId ? (
              <button type="button" onClick={() => deleteSession(editingSessionId)} className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200" disabled={isPending}>
                Delete session
              </button>
            ) : null}
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Scheduled date</span>
            <input type="date" value={draft.scheduledDate} onChange={(event) => updateDraft('scheduledDate', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none" />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Sport</span>
            <select value={draft.sportType} onChange={(event) => updateDraft('sportType', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none">
              {SPORT_OPTIONS.map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-2 text-sm text-slate-300">
          <span>Title</span>
          <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none" placeholder="Tempo session" />
        </label>

        <label className="space-y-2 text-sm text-slate-300">
          <span>Summary</span>
          <textarea value={draft.summary} onChange={(event) => updateDraft('summary', event.target.value)} className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none" placeholder="Short session summary for the week overview" />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Duration (min)</span>
            <input type="number" value={draft.durationMinutes ?? ''} onChange={(event) => updateDraft('durationMinutes', event.target.value ? Number(event.target.value) : null)} className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none" />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Distance (km)</span>
            <input type="number" step="0.1" value={draft.distanceKm ?? ''} onChange={(event) => updateDraft('distanceKm', event.target.value ? Number(event.target.value) : null)} className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none" />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Intensity</span>
            <input value={draft.intensity} onChange={(event) => updateDraft('intensity', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-white outline-none" placeholder="Easy, moderate, steady" />
          </label>
        </div>

        <WorkoutBlocksEditor
          title="Workout blocks"
          description="Structured details appear inside the session panel and athlete detail view."
          blocks={draft.blocks}
          onAddBlock={addBlock}
          onUpdateBlock={updateBlock}
          onRemoveBlock={removeBlock}
        />

        {errorMessage ? <p className="text-sm text-amber-300">{errorMessage}</p> : null}
      </CoachEditorDrawer>
    </>
  );
}
