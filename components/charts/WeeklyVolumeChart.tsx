'use client';

import { useState, type KeyboardEvent } from 'react';
import { formatDayShort, formatHours, niceCeiling } from '@/lib/chart-format';
import { formatDuration } from '@/lib/format-duration';

export type VolumeWeek = {
  weekStart: string;
  plannedSec: number;
  completedSec: number;
  completedTss: number;
  unknownLoadSessions: number;
  plannedTss: number;
  completionPct: number | null;
  isCurrent: boolean;
  isFuture: boolean;
};

/**
 * Weekly hours: the outline is the plan, the fill is what was done. Hover,
 * touch, or arrow keys select a week; the header reads it out.
 */
export function WeeklyVolumeChart({ weeks }: { weeks: VolumeWeek[] }) {
  const currentIndex = Math.max(0, weeks.findIndex((week) => week.isCurrent));
  const [active, setActive] = useState<number | null>(null);
  const shown = active ?? currentIndex;
  const week = weeks[shown];

  if (!week) return null;

  const max = niceCeiling(Math.max(3600, ...weeks.map((entry) => Math.max(entry.plannedSec, entry.completedSec))) / 3600) * 3600;

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') setActive(Math.max(0, shown - 1));
    else if (event.key === 'ArrowRight') setActive(Math.min(weeks.length - 1, shown + 1));
    else if (event.key === 'Home') setActive(0);
    else if (event.key === 'End') setActive(weeks.length - 1);
    // Escape clears a selection first; with none, it falls through to close an enclosing dialog.
    else if (event.key === 'Escape' && active !== null) setActive(null);
    else return;
    event.preventDefault();
  }

  const detail = week.isFuture
    ? `${formatDuration(week.plannedSec)} planned · ${week.plannedTss}\u00A0TSS`
    : `${formatDuration(week.completedSec)} of ${formatDuration(week.plannedSec)}\u00A0· ${week.unknownLoadSessions ? `TSS unavailable for ${week.unknownLoadSessions} activities` : `${week.completedTss}\u00A0TSS`}${
        week.completionPct !== null ? `\u00A0· ${week.completionPct}%` : ''
      }`;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
        <span className="data text-[var(--text-secondary)]">
          Week of {formatDayShort(week.weekStart)}
          {week.isCurrent ? ' · this week' : ''}
        </span>
        <span className="data text-[var(--text)]">{detail}</span>
      </figcaption>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={weeks.length - 1}
        aria-valuenow={shown}
        aria-valuetext={`Week of ${formatDayShort(week.weekStart)}: ${detail}`}
        tabIndex={0}
        aria-label={`Week of ${formatDayShort(week.weekStart)}: ${detail}. Use arrow keys to move between weeks.`}
        className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)]"
        onKeyDown={handleKey}
        onBlur={() => setActive(null)}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setActive(null);
        }}
      >
        <div className="relative flex h-36 items-end gap-[3px] border-b border-[var(--border)] pr-8">
          {[1, 0.5].map((fraction) => (
            <span key={fraction} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-[var(--border)]" style={{ bottom: `${fraction * 100}%` }}>
              <span className="data absolute -top-2 right-0 text-[11px] text-[var(--text-muted)]">{formatHours(max * fraction)}h</span>
            </span>
          ))}
          {weeks.map((entry, index) => {
            const plannedHeight = (entry.plannedSec / max) * 100;
            const completedHeight = (entry.completedSec / max) * 100;
            const isShown = index === shown;
            return (
              <div
                key={entry.weekStart}
                aria-hidden="true"
                className="relative flex h-full flex-1 cursor-pointer items-end hover:bg-[var(--field-surface)]"
                onPointerEnter={() => setActive(index)}
                onPointerDown={() => setActive(index)}
              >
                {entry.plannedSec > 0 ? (
                  <span
                    className="absolute inset-x-0 bottom-0 rounded-t-[3px] border border-b-0 border-[var(--border-strong)]"
                    style={{ height: `${plannedHeight}%` }}
                  />
                ) : null}
                <span
                  className="relative w-full rounded-t-[3px] transition-colors"
                  style={{
                    height: `${completedHeight}%`,
                    background: isShown ? 'var(--text)' : entry.isCurrent ? 'var(--color-trace-faint)' : 'var(--brand)',
                    opacity: isShown || entry.isCurrent ? 1 : 0.75,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="relative mr-8 mt-1.5 flex gap-[3px] text-[11px] text-[var(--text-muted)]" aria-hidden="true">
          {weeks.map((entry, index) => (
            <span key={entry.weekStart} className={`data flex-1 overflow-visible whitespace-nowrap text-center ${entry.isCurrent ? 'text-[var(--brand)]' : ''}`}>
              {(index - currentIndex) % 4 === 0 ? (entry.isCurrent ? 'Now' : formatDayShort(entry.weekStart)) : ''}
            </span>
          ))}
        </div>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px] bg-[var(--brand)]" /> Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px] border border-[var(--border-strong)]" /> Planned
        </span>
      </p>
    </figure>
  );
}
