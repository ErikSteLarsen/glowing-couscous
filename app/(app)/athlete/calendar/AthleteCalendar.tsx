'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarPlus, ChevronLeft, ChevronRight, MoveRight, Plus } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { ComplianceMark, complianceColors } from '@/components/tempo/ComplianceMark';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import {
  buttonFocusClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  formFieldClassName,
  getSwitchOptionClassName,
  ghostButtonClassName,
  iconButtonClassName,
  secondaryButtonClassName,
  switchTrackClassName,
  TopBar,
} from '@/components/ui';
import {
  getCalendarHref,
  getCalendarPeriodLabel,
  getCalendarShortcut,
  parseCalendarDay,
  stepCalendarPeriod,
  type CalendarView,
} from '@/lib/calendar-navigation';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { complianceLabels, fromDayKey, type ComplianceState, type WeekSummary } from '@/lib/training-load';

export type CalendarSession = {
  id: number;
  title: string;
  sport: string;
  timeLabel: string;
  durationSec: number;
  tss: number;
  compliance: ComplianceState;
  canReschedule: boolean;
  segments: Array<{ key: string; zone: number; durationSec: number; label: string; color: string }>;
};

export type CalendarDay = {
  isoDate: string;
  label: string;
  dateLabel: string;
  isToday: boolean;
  isCurrentMonth: boolean;
  sessions: CalendarSession[];
};

export type CalendarWeek = { weekStart: string; days: CalendarDay[]; summary: WeekSummary | null };

type Feedback = { tone: 'status' | 'alert'; text: string } | null;

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DONE_STATES = new Set<ComplianceState>(['complete', 'partial', 'off', 'unplanned']);

const formatDay = (day: string) => format(fromDayKey(day), 'EEE d MMM');
const dayDropId = (day: string) => `day:${day}`;
const sessionDragId = (sessionId: number) => `session:${sessionId}`;

/** The accent edge and, for finished work, a faint wash in the compliance color. */
function complianceStyle(state: ComplianceState): CSSProperties {
  const color = complianceColors[state];
  return {
    boxShadow: `inset 3px 0 0 ${color}`,
    background: DONE_STATES.has(state) ? `color-mix(in srgb, ${color} 9%, var(--surface))` : undefined,
  };
}

/** Prefer the day under the pointer; keyboard drags have no pointer, so fall back to overlap. */
const detectDayCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

const ARROW_DIRECTIONS: Record<string, [number, number]> = {
  ArrowRight: [1, 0],
  ArrowLeft: [-1, 0],
  ArrowDown: [0, 1],
  ArrowUp: [0, -1],
};

/** Arrow keys jump the dragged session to the nearest day in that direction. */
const dayKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const direction = ARROW_DIRECTIONS[event.code];
  const current = context.collisionRect;
  if (!direction || !current) return undefined;
  event.preventDefault();

  const centerX = current.left + current.width / 2;
  const centerY = current.top + current.height / 2;
  let best: { left: number; top: number; width: number; score: number } | null = null;
  for (const container of context.droppableContainers.getEnabled()) {
    const rect = context.droppableRects.get(container.id);
    if (!rect) continue;
    const dx = rect.left + rect.width / 2 - centerX;
    const dy = rect.top + Math.min(rect.height / 2, 40) - centerY;
    const along = dx * direction[0] + dy * direction[1];
    if (along <= 4) continue;
    const across = Math.abs(dx * direction[1]) + Math.abs(dy * direction[0]);
    const score = along + across * 3;
    if (!best || score < best.score) best = { left: rect.left, top: rect.top, width: rect.width, score };
  }
  if (!best) return undefined;
  return { x: best.left + (best.width - current.width) / 2, y: best.top + 8 };
};

export function AthleteCalendar({
  view,
  day,
  today,
  weeks,
}: {
  view: CalendarView;
  day: string;
  today: string;
  weeks: CalendarWeek[];
}) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const saving = useRef(false);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(() =>
    weeks.some((week) => week.days.some((entry) => entry.isoDate === day && entry.isCurrentMonth)) ? day : null,
  );
  const dragging = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      // Enter still opens the session; Space picks it up.
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
      coordinateGetter: dayKeyboardCoordinates,
    }),
  );

  const { sessionsById, dayOfSession } = useMemo(() => {
    const byId = new Map<number, CalendarSession>();
    const serverDay = new Map<number, string>();
    for (const week of weeks) {
      for (const entry of week.days) {
        for (const session of entry.sessions) {
          byId.set(session.id, session);
          serverDay.set(session.id, entry.isoDate);
        }
      }
    }
    return { sessionsById: byId, dayOfSession: serverDay };
  }, [weeks]);

  const allDays = useMemo(() => weeks.flatMap((week) => week.days), [weeks]);
  const busyIds = isRefreshing || pendingIds.length > 0 ? [...sessionsById.keys()] : [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (dragging.current) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const shortcut = getCalendarShortcut({
        key: event.key,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        defaultPrevented: event.defaultPrevented,
        targetTagName: target?.tagName ?? null,
        targetIsEditable: target?.isContentEditable ?? false,
      });
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut.type === 'step') router.push(getCalendarHref(view, stepCalendarPeriod(view, day, shortcut.direction)));
      if (shortcut.type === 'today') router.push(getCalendarHref(view, today));
      if (shortcut.type === 'view' && shortcut.view !== view) router.push(getCalendarHref(shortcut.view, day));
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router, view, day, today]);

  async function moveSession(sessionId: number, toDay: string) {
    const session = sessionsById.get(sessionId);
    const fromDay = dayOfSession.get(sessionId);
    if (!session?.canReschedule || !fromDay || fromDay === toDay || saving.current || isRefreshing || !parseCalendarDay(toDay)) return;

    saving.current = true;
    setPendingIds((current) => [...current, sessionId]);
    setFeedback({ tone: 'status', text: `Moving ${session.title} to ${formatDay(toDay)}…` });

    try {
      const response = await fetch(`/api/athlete/planner/sessions/${sessionId}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: toDay }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const reason = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : 'The session could not be moved.';
        throw new Error(reason);
      }
      setFeedback({ tone: 'status', text: `Moved ${session.title} to ${formatDay(toDay)}.` });
      if (allDays.some((entry) => entry.isoDate === toDay)) setSelectedDay(toDay);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'The session could not be moved.';
      setFeedback({ tone: 'alert', text: `Could not confirm moving ${session.title}. ${reason} Refreshing the schedule.` });
    } finally {
      saving.current = false;
      startTransition(() => router.refresh());
      setPendingIds((current) => current.filter((id) => id !== sessionId));
    }
  }

  const titleFor = (id: unknown) => sessionsById.get(Number(String(id).replace('session:', '')))?.title ?? 'Session';
  const dayFor = (id: unknown) => formatDay(String(id).replace('day:', ''));
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleFor(active.id)}. Use the arrow keys to choose a day, then press space to drop it or escape to cancel.`,
    onDragOver: ({ active, over }) => (over ? `${titleFor(active.id)} is over ${dayFor(over.id)}.` : `${titleFor(active.id)} is not over a day.`),
    onDragEnd: ({ active, over }) => (over ? `${titleFor(active.id)} dropped on ${dayFor(over.id)}.` : `${titleFor(active.id)} was not moved.`),
    onDragCancel: ({ active }) => `Moving ${titleFor(active.id)} was cancelled.`,
  };

  function handleDragStart(event: DragStartEvent) {
    dragging.current = true;
    setActiveId(Number(event.active.data.current?.sessionId));
  }

  function handleDragEnd(event: DragEndEvent) {
    dragging.current = false;
    setActiveId(null);
    const sessionId = Number(event.active.data.current?.sessionId);
    const toDay = event.over?.data.current?.day;
    if (typeof toDay === 'string') void moveSession(sessionId, toDay);
  }

  const activeSession = activeId === null ? null : sessionsById.get(activeId) ?? null;
  const selected = selectedDay ? allDays.find((entry) => entry.isoDate === selectedDay) ?? null : null;
  const periodNoun = view === 'week' ? 'week' : 'month';
  const shared = { pendingIds: busyIds, onMove: moveSession };

  return (
    <div className="flex flex-col gap-6">
      <TopBar
        eyebrow={getCalendarPeriodLabel(view, day)}
        title="Calendar"
        actions={
          <>
            <nav aria-label={`${view === 'week' ? 'Week' : 'Month'} navigation`} className="flex items-center gap-2">
              <Link href={getCalendarHref(view, stepCalendarPeriod(view, day, -1))} aria-label={`Previous ${periodNoun}`} aria-keyshortcuts="ArrowLeft" className={iconButtonClassName}>
                <ChevronLeft aria-hidden="true" size={18} strokeWidth={1.8} />
              </Link>
              <Link href={getCalendarHref(view, today)} aria-keyshortcuts="T" className={`${secondaryButtonClassName} min-h-10`}>
                Today
              </Link>
              <Link href={getCalendarHref(view, stepCalendarPeriod(view, day, 1))} aria-label={`Next ${periodNoun}`} aria-keyshortcuts="ArrowRight" className={iconButtonClassName}>
                <ChevronRight aria-hidden="true" size={18} strokeWidth={1.8} />
              </Link>
            </nav>
            <div role="group" aria-label="Calendar view" className={switchTrackClassName}>
              <Link href={getCalendarHref('week', day)} aria-current={view === 'week' ? 'page' : undefined} aria-keyshortcuts="W" className={`${getSwitchOptionClassName(view === 'week')} min-h-9`}>
                Week
              </Link>
              <Link href={getCalendarHref('month', day)} aria-current={view === 'month' ? 'page' : undefined} aria-keyshortcuts="M" className={`${getSwitchOptionClassName(view === 'month')} min-h-9`}>
                Month
              </Link>
            </div>
          </>
        }
      />

      <p className="sr-only">
        Shortcuts: left and right arrows change the {periodNoun}, T jumps to today, W and M switch view. Focus a planned session and press space to move it.
      </p>

      <div role="status" className="empty:hidden">
        {feedback?.tone === 'status' ? <p className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">{feedback.text}</p> : null}
      </div>
      <div role="alert" className="empty:hidden">
        {feedback?.tone === 'alert' ? (
          <p className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-tint)] px-3 py-2 text-sm text-[var(--status-danger)]">{feedback.text}</p>
        ) : null}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={detectDayCollision}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: 'To move a session, press space, use the arrow keys to choose a day, and press space again to drop it. Press escape to cancel. Press enter to open it.',
          },
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          dragging.current = false;
          setActiveId(null);
        }}
      >
        {view === 'week' ? (
          <WeekBoard week={weeks[0]} {...shared} />
        ) : (
          <MonthBoard weeks={weeks} selectedDay={selectedDay} onSelectDay={setSelectedDay} pendingIds={busyIds} />
        )}
        <DragOverlay dropAnimation={null}>
          {activeSession ? (
            <div className="rounded-lg border border-[var(--border-strong)] bg-[var(--raised)] px-3 py-2 text-[13px] font-medium text-[var(--text)] shadow-[var(--shadow-raised)]" style={complianceStyle(activeSession.compliance)}>
              {activeSession.title}
            </div>
          ) : null}
        </DragOverlay>
        {view === 'month' && selected ? <DayDetail day={selected} onClose={() => setSelectedDay(null)} {...shared} /> : null}
      </DndContext>
    </div>
  );
}

type MoveProps = { pendingIds: number[]; onMove: (sessionId: number, toDay: string) => Promise<void> };

function WeekBoard({ week, pendingIds, onMove }: { week: CalendarWeek } & MoveProps) {
  return (
    <section aria-label="Week" className="grid gap-3 xl:grid-cols-[repeat(7,minmax(0,1fr))_13rem]">
      <WeekSummaryPanel summary={week.summary} className="xl:order-last" />
      {week.days.map((entry) => (
        <DayColumn key={entry.isoDate} day={entry} pendingIds={pendingIds} onMove={onMove} />
      ))}
    </section>
  );
}

function DayColumn({ day, pendingIds, onMove }: { day: CalendarDay } & MoveProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day.isoDate), data: { day: day.isoDate } });
  const headingId = `calendar-day-${day.isoDate}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={`flex min-w-0 flex-col gap-2 rounded-xl border p-2.5 transition-colors xl:min-h-[18rem] ${
        isOver
          ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
          : day.isToday
            ? 'border-[var(--status-planned-border)] bg-[var(--surface)]'
            : 'border-[var(--border)]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={headingId} className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-[var(--text-muted)]">{day.label}</span>
          <span className={`data text-lg font-medium ${day.isToday ? 'text-[var(--brand)]' : 'text-[var(--text)]'}`}>{day.dateLabel}</span>
          {day.isToday ? <span className="text-xs font-medium text-[var(--brand)]">Today</span> : null}
        </h2>
        {day.sessions.length > 0 ? (
          <Link
            href={`/athlete/planner?date=${day.isoDate}`}
            aria-label={`Plan a session on ${formatDay(day.isoDate)}`}
            className={`inline-flex size-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--raised)] hover:text-[var(--text)] xl:size-8 ${buttonFocusClassName}`}
          >
            <Plus aria-hidden="true" size={16} strokeWidth={1.8} />
          </Link>
        ) : null}
      </div>

      {day.sessions.map((session) => (
        <SessionCard key={session.id} session={session} day={day.isoDate} pending={pendingIds.includes(session.id)} onMove={onMove} />
      ))}

      {day.sessions.length === 0 ? (
        <Link
          href={`/athlete/planner?date=${day.isoDate}`}
          aria-label={`Plan here, ${formatDay(day.isoDate)}`}
          className={`group flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-2 text-[13px] text-[var(--text-muted)] transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] ${buttonFocusClassName}`}
        >
          <CalendarPlus aria-hidden="true" size={15} strokeWidth={1.8} />
          Plan here
        </Link>
      ) : null}
    </section>
  );
}

function useSessionDrag(session: CalendarSession, pending: boolean, draggable = true) {
  const enabled = draggable && session.canReschedule;
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    // The month detail panel repeats sessions from the grid, so it registers under its own id.
    id: draggable ? sessionDragId(session.id) : `detail:${session.id}`,
    data: { sessionId: session.id },
    disabled: !enabled || pending,
  });
  // The session stays a link: keep its role and only borrow the drag description.
  const dragProps = enabled
    ? { ...listeners, 'aria-describedby': attributes['aria-describedby'] }
    : {};
  return { setNodeRef, setActivatorNodeRef, dragProps, isDragging };
}

function sessionLabel(session: CalendarSession, day: string) {
  return [session.title, formatDay(day), getSportLabel(session.sport), formatDuration(session.durationSec), `${session.tss} TSS`, complianceLabels[session.compliance]].join(', ');
}

function SessionCard({
  session,
  day,
  pending,
  onMove,
  draggable = true,
}: {
  session: CalendarSession;
  day: string;
  pending: boolean;
  onMove: MoveProps['onMove'];
  draggable?: boolean;
}) {
  const { setNodeRef, setActivatorNodeRef, dragProps, isDragging } = useSessionDrag(session, pending, draggable);
  const [moving, setMoving] = useState(false);

  return (
    <div ref={setNodeRef} className={`min-w-0 ${isDragging ? 'opacity-40' : ''}`}>
      <Link
        ref={setActivatorNodeRef}
        href={`/athlete/session/${session.id}?from=calendar`}
        aria-label={`Open ${sessionLabel(session, day)}`}
        className={`block space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-3.5 pr-3 transition-colors hover:border-[var(--border-strong)] ${
          draggable && session.canReschedule ? 'cursor-grab active:cursor-grabbing' : ''
        } ${pending ? 'opacity-70' : ''} ${buttonFocusClassName}`}
        style={complianceStyle(session.compliance)}
        {...dragProps}
      >
        <p className="break-words text-[13px] font-medium leading-snug text-[var(--text)]">{session.title}</p>
        <p className="data text-xs text-[var(--text-secondary)]">
          {getSportLabel(session.sport)} · {formatDuration(session.durationSec)} · {session.tss} TSS
        </p>
        <ComplianceMark state={session.compliance} showLabel />
        <SessionBlockBar segments={session.segments} size="compact" />
      </Link>
      {session.canReschedule ? (
        moving ? (
          <MoveToForm session={session} day={day} onCancel={() => setMoving(false)} onMove={async (toDay) => {
            setMoving(false);
            await onMove(session.id, toDay);
          }} />
        ) : (
          <button
            type="button"
            disabled={pending}
            aria-label={`Move ${session.title} to another day`}
            className={`${ghostButtonClassName('compact')} mt-1 min-h-11 w-full justify-start xl:min-h-8`}
            onClick={() => setMoving(true)}
          >
            <MoveRight aria-hidden="true" size={14} strokeWidth={1.8} />
            Move to…
          </button>
        )
      ) : null}
    </div>
  );
}

function MoveToForm({
  session,
  day,
  onMove,
  onCancel,
}: {
  session: CalendarSession;
  day: string;
  onMove: (toDay: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(day);
  const inputId = `move-${session.id}`;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (parseCalendarDay(value)) void onMove(value);
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--raised)] p-2.5">
      <label htmlFor={inputId} className="block text-xs font-medium text-[var(--text-secondary)]">
        Move {session.title} to
      </label>
      <input
        id={inputId}
        type="date"
        required
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
        autoFocus
        className={`${formFieldClassName} data min-h-11`}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={value === day} className={`${compactPrimaryButtonClassName} min-h-11 flex-1 xl:min-h-8`}>
          Move
        </button>
        <button type="button" onClick={onCancel} className={`${compactSecondaryButtonClassName} min-h-11 flex-1 xl:min-h-8`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function WeekSummaryPanel({ summary, className = '', compact = false }: { summary: CalendarWeek['summary']; className?: string; compact?: boolean }) {
  const planned = summary?.planned ?? { durationSec: 0, tss: 0, sessions: 0 };
  const completed = summary?.completed ?? { durationSec: 0, tss: 0, sessions: 0 };
  const pct = summary?.completionPct ?? null;
  const missed = summary?.missed ?? 0;
  const barWidth = pct === null ? 0 : Math.min(100, pct);

  return (
    <aside aria-label="Week summary" className={`tile min-w-0 rounded-xl ${compact ? 'p-2.5' : 'p-3.5'} ${className}`}>
      <div className={compact ? 'flex flex-wrap items-center gap-x-4 gap-y-1.5' : 'space-y-3'}>
        <dl className={compact ? 'contents' : 'grid grid-cols-2 gap-3 xl:grid-cols-1'}>
          <div className={compact ? 'flex items-baseline gap-1.5' : ''}>
            <dt className="text-xs text-[var(--text-muted)]">Duration</dt>
            <dd className="data text-sm text-[var(--text)]">
              {formatDuration(completed.durationSec)}
              <span className="text-[var(--text-muted)]"> / {formatDuration(planned.durationSec)}</span>
            </dd>
          </div>
          <div className={compact ? 'flex items-baseline gap-1.5' : ''}>
            <dt className="text-xs text-[var(--text-muted)]">TSS</dt>
            <dd className="data text-sm text-[var(--text)]">
              {Math.round(completed.tss)}
              <span className="text-[var(--text-muted)]"> / {Math.round(planned.tss)}</span>
            </dd>
          </div>
        </dl>
        <div className={compact ? 'flex min-w-[8rem] flex-1 items-center gap-2' : 'space-y-1.5'}>
          <div aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--raised)]">
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${barWidth}%` }} />
          </div>
          <p className="data flex flex-wrap gap-x-3 text-xs text-[var(--text-secondary)]">
            <span>{pct === null ? 'Nothing planned' : `${pct}% complete`}</span>
            {missed > 0 ? <span className="inline-flex items-center gap-1"><ComplianceMark state="missed" /> {missed} missed</span> : null}
          </p>
        </div>
      </div>
    </aside>
  );
}

function MonthBoard({
  weeks,
  selectedDay,
  onSelectDay,
  pendingIds,
}: {
  weeks: CalendarWeek[];
  pendingIds: number[];
  selectedDay: string | null;
  onSelectDay: (day: string) => void;
}) {
  return (
    <section aria-label="Month" className="min-w-0 space-y-2">
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 sm:gap-1.5 xl:grid-cols-[repeat(7,minmax(0,1fr))_12rem]">
        {WEEKDAY_LABELS.map((label) => (
          <p key={label} className="px-1 text-xs font-medium text-[var(--text-muted)]">{label}</p>
        ))}
        <p className="hidden px-1 text-xs font-medium text-[var(--text-muted)] xl:block">Week</p>
      </div>
      {weeks.map((week) => (
        <div key={week.weekStart} className="grid grid-cols-7 gap-1 sm:gap-1.5 xl:grid-cols-[repeat(7,minmax(0,1fr))_12rem]">
          {week.days.map((entry) => (
            <MonthCell key={entry.isoDate} day={entry} selected={entry.isoDate === selectedDay} onSelect={onSelectDay} pendingIds={pendingIds} />
          ))}
          <WeekSummaryPanel summary={week.summary} compact className="col-span-7 xl:col-span-1" />
        </div>
      ))}
    </section>
  );
}

function MonthCell({ day, selected, onSelect, pendingIds }: { day: CalendarDay; selected: boolean; onSelect: (day: string) => void; pendingIds: number[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: dayDropId(day.isoDate), data: { day: day.isoDate } });
  const count = day.sessions.length;

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[4.5rem] min-w-0 flex-col gap-1 rounded-lg border p-1 transition-colors sm:min-h-[7.5rem] sm:p-1.5 ${
        isOver
          ? 'border-[var(--brand)] bg-[var(--brand-tint)]'
          : selected
            ? 'border-[var(--border-strong)] bg-[var(--raised)]'
            : day.isToday
              ? 'border-[var(--status-planned-border)]'
              : 'border-[var(--border)]'
      } ${day.isCurrentMonth ? '' : 'opacity-55'}`}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${formatDay(day.isoDate)}${day.isToday ? ', today' : ''}, ${count} ${count === 1 ? 'session' : 'sessions'}`}
        onClick={() => onSelect(day.isoDate)}
        className={`flex min-h-11 w-full items-start justify-between rounded-md px-1 pt-0.5 text-left sm:min-h-7 ${buttonFocusClassName}`}
      >
        <span
          className={`data inline-flex min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-medium ${
            day.isToday ? 'bg-[var(--brand)] text-[var(--signal-ink)]' : day.isCurrentMonth ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'
          }`}
        >
          {day.dateLabel}
        </span>
        {/* Small screens get a dot per session; chips need room. */}
        <span aria-hidden="true" className="flex flex-wrap justify-end gap-0.5 pt-1 sm:hidden">
          {day.sessions.slice(0, 3).map((session) => (
            <span key={session.id} className="size-1.5 rounded-full" style={{ background: complianceColors[session.compliance] }} />
          ))}
        </span>
      </button>
      <div className="hidden min-w-0 flex-col gap-1 sm:flex">
        {day.sessions.map((session) => (
          <MonthChip key={session.id} session={session} day={day.isoDate} pending={pendingIds.includes(session.id)} />
        ))}
      </div>
    </div>
  );
}

function MonthChip({ session, day, pending }: { session: CalendarSession; day: string; pending: boolean }) {
  const { setNodeRef, setActivatorNodeRef, dragProps, isDragging } = useSessionDrag(session, pending);

  return (
    <div ref={setNodeRef} className={isDragging ? 'opacity-40' : undefined}>
      <Link
        ref={setActivatorNodeRef}
        href={`/athlete/session/${session.id}?from=calendar`}
        aria-label={`Open ${sessionLabel(session, day)}`}
        className={`flex min-h-8 min-w-0 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] py-1 pl-2 pr-1.5 text-xs transition-colors hover:border-[var(--border-strong)] ${
          session.canReschedule ? 'cursor-grab active:cursor-grabbing' : ''
        } ${buttonFocusClassName}`}
        style={complianceStyle(session.compliance)}
        {...dragProps}
      >
        <span className="min-w-0 flex-1 truncate text-[var(--text)]">{session.title}</span>
        <span className="data hidden shrink-0 text-[var(--text-muted)] lg:inline">{formatDuration(session.durationSec)}</span>
        <ComplianceMark state={session.compliance} />
      </Link>
    </div>
  );
}

function DayDetail({ day, onClose, pendingIds, onMove }: { day: CalendarDay; onClose: () => void } & MoveProps) {
  return (
    <section aria-labelledby="calendar-day-detail" className="tile space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="calendar-day-detail" className="text-base font-medium text-[var(--text)]">{format(fromDayKey(day.isoDate), 'EEEE d MMMM')}</h2>
        <div className="flex gap-2">
          <Link href={`/athlete/planner?date=${day.isoDate}`} className={`${compactSecondaryButtonClassName} min-h-11 sm:min-h-8`}>
            <CalendarPlus aria-hidden="true" size={14} strokeWidth={1.8} />
            Plan here
          </Link>
          <button type="button" onClick={onClose} className={`${ghostButtonClassName('compact')} min-h-11 sm:min-h-8`}>
            Close
          </button>
        </div>
      </div>
      {day.sessions.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {day.sessions.map((session) => (
            <SessionCard key={session.id} session={session} day={day.isoDate} pending={pendingIds.includes(session.id)} onMove={onMove} draggable={false} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">Nothing planned. Rest, or plan a session for this day.</p>
      )}
    </section>
  );
}
