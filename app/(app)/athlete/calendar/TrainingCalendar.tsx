'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, addMonths, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Search, X, Trash2 } from 'lucide-react';
import { ActionLink, TopBar, primaryButtonClassName, ghostButtonClassName, formFieldClassName, getSegmentedChoiceClassName, buttonFocusClassName } from '@/components/ui';
import { SessionRow, type SessionRowData } from '@/components/tempo/SessionRow';
import type { PersonalPlannerSource } from '@/lib/planner-view';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { isAssignmentDate, templateDatesForSelection } from '@/lib/template-cadence';

type CalendarDay = { isoDate: string; label: string; dateLabel: string; isToday: boolean; isCurrentMonth: boolean; sessions: SessionRowData[] };
export function TrainingCalendar({ date, view, label, today, days, sources, initiallyAdding = false }: {
  date: string; view: 'week' | 'month'; label: string; today: string;
  days: CalendarDay[]; sources: PersonalPlannerSource[]; initiallyAdding?: boolean;
}) {
  const router = useRouter();
  const [navigating, navigate] = useTransition();
  const [active, setActive] = useState(date);
  const [lastDate, setLastDate] = useState(date);
  if (lastDate !== date) { setLastDate(date); setActive(date); }
  const [adding, setAdding] = useState(initiallyAdding);
  const [tab, setTab] = useState<'workout' | 'template'>('workout');
  const [query, setQuery] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [selectedDates, setSelectedDates] = useState([date]);
  const [extraDate, setExtraDate] = useState(date);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const inFlight = useRef(false);
  const request = useRef<{ signature: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const source = sources.find(item => item.key === sourceKey && item.kind === tab);
  const dates = source?.kind === 'template'
    ? templateDatesForSelection(source.cadence ?? 'day', selectedDates[0] ?? date)
    : selectedDates;
  const filtered = sources.filter(item => item.kind === tab && `${item.title} ${item.sport} ${item.summary ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedDay = days.find(day => day.isoDate === active) ?? days[0];
  const weekCount = days.reduce((sum, day) => sum + day.sessions.length, 0);
  function go(nextDate: string, nextView = view) {
    if (inFlight.current) return;
    setActive(nextDate);
    navigate(() => router.push(`/athlete/calendar?${new URLSearchParams({ date: nextDate, view: nextView })}`, { scroll: false }));
  }
  function open(day: string) {
    setActive(day); setSelectedDates([day]); setExtraDate(day); setAdding(true); setNotice(null);
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  }
  function close() { if (busy) return; setAdding(false); addButton.current?.focus(); }
  function chooseDay(day: string) {
    setActive(day); setExtraDate(day);
    if (adding) setSelectedDates(current => source?.kind === 'template' ? [day] : current.includes(day) ? current.filter(item => item !== day) : [...current, day].sort());
  }
  async function schedule() {
    if (!source || !dates.length || inFlight.current) return;
    inFlight.current = true; setBusy(true); setNotice(null);
    const signature = JSON.stringify({ sourceKind: source.kind, sourceId: source.id, dates: [...dates].sort() });
    if (request.current?.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    let saved = false;
    try {
      const response = await fetch('/api/athlete/planner/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKind: source.kind, sourceId: source.id, dates, requestKey: request.current.key }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'Could not schedule. Try again.');
      request.current = null;
      saved = true;
      setNotice({ text: `${source.title} scheduled · ${payload.sessionIds?.length ?? dates.length} sessions added.`, error: false });
      setAdding(false); setSourceKey(''); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : 'Could not confirm scheduling. Check your connection and retry; your selection is saved here.', error: true }); }
    finally { inFlight.current = false; setBusy(false); if (saved) requestAnimationFrame(() => addButton.current?.focus()); }
  }
  async function remove(session: SessionRowData) {
    if (inFlight.current || !window.confirm(`Remove "${session.title}" from the calendar? This cannot be undone.`)) return;
    inFlight.current = true; setBusy(true);
    try {
      const response = await fetch(`/api/athlete/planner/sessions/${session.id}`, { method: 'DELETE' });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload.error ?? 'Could not remove session.'); }
      setNotice({ text: `${session.title} removed.`, error: false }); router.refresh();
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : 'Could not remove session. Try again.', error: true }); }
    finally { inFlight.current = false; setBusy(false); }
  }
  function agenda(day: CalendarDay) {
    return <div className="training-calendar__sessions">
      {day.sessions.length ? day.sessions.map(session => <div key={session.id} className="training-calendar__session">
        <SessionRow session={session} href={`/athlete/session/${session.id}?from=calendar`} variant="calendar" showTime={false} muted={session.status === 'completed'} />
        {session.status !== 'completed' && <button type="button" disabled={busy} onClick={() => void remove(session)} aria-label={`Remove ${session.title}`} className={`${ghostButtonClassName('compact')} training-calendar__remove`}><Trash2 size={14} /></button>}
      </div>) : <p className="py-4 text-[13px] text-[var(--text-muted)]">Nothing scheduled</p>}
      <button type="button" disabled={busy} className={`${ghostButtonClassName('compact')} w-full gap-2`} onClick={() => open(day.isoDate)}><Plus size={15} /> Add session</button>
    </div>;
  }
  return <div className="space-y-6">
    <TopBar title="Calendar" description="Your training, one day at a time." actions={<button ref={addButton} type="button" disabled={busy} className={`${primaryButtonClassName} gap-2`} onClick={() => adding ? close() : open(active)}><Plus size={17} /> Add session</button>} />
    {notice && <div role={notice.error ? 'alert' : 'status'} className={`rounded-[10px] p-3 text-sm ${notice.error ? 'bg-[var(--danger-tint)] text-[var(--status-danger)]' : 'bg-[var(--success-tint)] text-[var(--status-success)]'}`}>{notice.text}</div>}
    <div className="training-calendar__toolbar" aria-busy={navigating}>
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy || navigating} aria-label={`Previous ${view}`} className={ghostButtonClassName('compact')} onClick={() => go(format(view === 'month' ? addMonths(parseISO(date), -1) : addDays(parseISO(date), -7), 'yyyy-MM-dd'))}><ChevronLeft size={18} /></button>
        <h2 className="text-lg font-semibold">{label}</h2>
        <button type="button" disabled={busy || navigating} aria-label={`Next ${view}`} className={ghostButtonClassName('compact')} onClick={() => go(format(view === 'month' ? addMonths(parseISO(date), 1) : addDays(parseISO(date), 7), 'yyyy-MM-dd'))}><ChevronRight size={18} /></button>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy || navigating} className={ghostButtonClassName('compact')} onClick={() => go(today)}>Today</button>
        <div className="inline-flex gap-1 rounded-[10px] bg-[var(--field-surface)] p-1" aria-label="Calendar view">
          {(['week', 'month'] as const).map(choice => <button key={choice} type="button" disabled={busy || navigating} aria-pressed={view === choice} className={getSegmentedChoiceClassName(view === choice, 'compact')} onClick={() => go(active, choice)}>{choice === 'week' ? 'Week' : 'Month'}</button>)}
        </div>
      </div>
    </div>
    <div className={`training-calendar__layout ${adding ? 'training-calendar__layout--adding' : ''}`}>
      {adding && <aside className="training-calendar__composer" aria-labelledby="schedule-heading" onKeyDown={event => { if (event.key === 'Escape') close(); }}>
        <div className="flex items-center justify-between gap-3"><h2 ref={heading} tabIndex={-1} id="schedule-heading" className="text-lg font-semibold outline-none">Add to calendar</h2><button type="button" disabled={busy} onClick={close} aria-label="Close scheduling" className={ghostButtonClassName('compact')}><X size={18} /></button></div>
        <p className="text-sm text-[var(--text-secondary)]">Choose saved content, then review its dates.</p>
        <div className="flex gap-1" aria-label="Content type">{(['workout', 'template'] as const).map(kind => <button key={kind} type="button" disabled={busy} aria-pressed={tab === kind} className={getSegmentedChoiceClassName(tab === kind, 'compact')} onClick={() => { setTab(kind); setSourceKey(''); setQuery(''); setSelectedDates([active]); setExtraDate(active); }}>{kind === 'workout' ? 'Workouts' : 'Templates'}</button>)}</div>
        <label className="relative block"><span className="sr-only">Search {tab}s</span><Search size={15} className="absolute left-3 top-3 text-[var(--text-muted)]" /><input disabled={busy} value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tab}s`} className={`${formFieldClassName} pl-9`} /></label>
        <div className="training-calendar__sources">
          {filtered.map(item => <button type="button" key={item.key} disabled={busy} aria-pressed={sourceKey === item.key} className={`training-calendar__source ${buttonFocusClassName}`} onClick={() => { setSourceKey(item.key); if (item.kind === 'template') { setSelectedDates([active]); setExtraDate(active); } setExtraDate(active); }}><strong>{item.title}</strong><span>{getSportLabel(item.sport)} · {item.kind === 'workout' ? formatDuration(item.durationSec ?? 0) : `${item.cadence} template`}</span></button>)}
          {!filtered.length && <div className="space-y-3 py-3"><p className="text-sm text-[var(--text-muted)]">{query ? 'No matches. Try another search.' : `No saved ${tab}s yet.`}</p><ActionLink href={tab === 'workout' ? '/athlete/workouts' : '/athlete/templates'} tone="secondary" size="compact">{tab === 'workout' ? 'Create workout' : 'Create template'}</ActionLink></div>}
        </div>
        <label className="space-y-2 text-sm font-medium block">{source?.kind === 'template' ? source.cadence === 'day' ? 'Template date' : 'Week or month containing' : 'Add a date'}<input type="date" disabled={busy} value={extraDate} className={formFieldClassName} onChange={event => { setExtraDate(event.target.value); if (isAssignmentDate(event.target.value)) setSelectedDates(current => source?.kind === 'template' ? [event.target.value] : Array.from(new Set([...current, event.target.value])).sort()); }} /></label>
        <div className="space-y-2"><p className="text-sm font-medium">{source?.kind === 'template' ? 'Full template range' : 'Selected dates'}</p>
          {source?.kind === 'template' && dates.length ? <p className="text-sm text-[var(--text-secondary)]">{format(parseISO(dates[0]), 'd MMM yyyy')} – {format(parseISO(dates[dates.length - 1]), 'd MMM yyyy')} · {dates.length} days</p> : <div className="flex flex-wrap gap-2">{dates.map(day => <button type="button" key={day} disabled={busy} aria-label={`Remove date ${day}`} className={`${ghostButtonClassName('compact')} gap-2`} onClick={() => setSelectedDates(current => current.filter(item => item !== day))}>{format(parseISO(day), 'd MMM')}<X size={12} /></button>)}</div>}
          <p className="text-xs text-[var(--text-muted)]">{source?.kind === 'template' ? 'Weeks start Monday. Month templates cover the whole month.' : 'Click calendar dates to select several days.'}</p>
        </div>
        <button type="button" disabled={!source || !dates.length || busy} onClick={() => void schedule()} className={`${primaryButtonClassName} w-full`}>{busy ? 'Scheduling…' : `Schedule${source ? ` ${source.kind === 'template' ? 'template' : dates.length === 1 ? 'workout' : `${dates.length} sessions`}` : ''}`}</button>
        <p className="text-xs text-[var(--text-muted)]">Scheduled sessions are independent copies. Your saved content stays reusable.</p>
      </aside>}
      <section className="training-calendar__main" aria-label={`${view} calendar`} aria-busy={navigating}>
        {view === 'week' && <p className="mb-4 text-sm text-[var(--text-muted)]">{weekCount} sessions this week</p>}
        <div className={`training-calendar__grid training-calendar__grid--${view}`}>
          {days.map(day => <section key={day.isoDate} className={`training-calendar__day ${day.isToday ? 'calendar-day--today' : ''} ${day.isCurrentMonth || view === 'week' ? '' : 'training-calendar__day--outside'}`} data-selected={adding ? dates.includes(day.isoDate) : active === day.isoDate}>
            <button type="button" disabled={busy} className={`training-calendar__date ${buttonFocusClassName}`} aria-pressed={adding ? dates.includes(day.isoDate) : active === day.isoDate} aria-current={day.isToday ? 'date' : undefined} aria-label={`${format(parseISO(day.isoDate), 'EEEE d MMMM')}, ${day.sessions.length} sessions${day.isToday ? ', today' : ''}`} onClick={() => chooseDay(day.isoDate)}><span>{day.label}</span><strong>{day.dateLabel}</strong><span className="training-calendar__count">{day.sessions.length || ''}</span></button>
            <div className="training-calendar__day-content">{view === 'week' ? agenda(day) : <div className="space-y-2">{day.sessions.slice(0, 2).map(session => <SessionRow key={session.id} session={session} href={`/athlete/session/${session.id}?from=calendar`} variant="month" showTime={false} />)}{day.sessions.length > 2 && <button type="button" className={ghostButtonClassName('compact')} onClick={() => setActive(day.isoDate)}>+{day.sessions.length - 2} more</button>}<button type="button" disabled={busy} aria-label={`Add session on ${day.isoDate}`} className={`${ghostButtonClassName('compact')} gap-1`} onClick={() => open(day.isoDate)}><Plus size={14} /><span className="sr-only">Add session</span></button></div>}</div>
          </section>)}
        </div>
        {selectedDay && <section className={`training-calendar__agenda ${view === 'month' ? 'training-calendar__agenda--month' : ''}`} aria-label="Selected day"><h3 className="mb-3 text-lg font-semibold">{format(parseISO(selectedDay.isoDate), 'EEEE, d MMMM')}</h3>{agenda(selectedDay)}</section>}
      </section>
    </div>
  </div>;
}
