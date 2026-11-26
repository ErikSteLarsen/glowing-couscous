'use client';

import { useState, type ReactNode } from 'react';
import { complianceColors } from '@/components/tempobuilder/ComplianceMark';
import { complianceLabels, type ComplianceState } from '@/lib/training-load';

export type HomeWeekDay = {
  isoDate: string;
  label: string;
  dateLabel: string;
  /** Full name for the chip's accessible label, e.g. "Thursday 26". */
  longLabel: string;
  isToday: boolean;
  marks: ComplianceState[];
  panel: ReactNode;
};

function chipLabel(day: HomeWeekDay): string {
  const count = day.marks.length;
  const today = day.isToday ? ', today' : '';
  if (count === 0) return `${day.longLabel}${today}, rest`;
  const byState = new Map<ComplianceState, number>();
  for (const state of day.marks) byState.set(state, (byState.get(state) ?? 0) + 1);
  const breakdown = [...byState].map(([state, n]) => `${n} ${complianceLabels[state].toLowerCase()}`).join(', ');
  return `${day.longLabel}${today}, ${count} ${count === 1 ? 'workout' : 'workouts'}: ${breakdown}`;
}

/**
 * Home's week. Phones show seven day chips and only the selected day's
 * workouts, starting on today; wider screens show every day as a column.
 */
export function HomeWeekDays({ days }: { days: HomeWeekDay[] }) {
  const [selected, setSelected] = useState(() => (days.find((day) => day.isToday) ?? days[0])?.isoDate);

  return (
    <div className="space-y-2.5">
      {/* Below 380px the row bleeds into the page gutter so seven chips stay 44px wide. */}
      <div className="grid grid-cols-7 gap-1 max-[379px]:-mx-5 max-[379px]:gap-0.5 md:hidden" role="group" aria-label="Choose a day">
        {days.map((day) => {
          const isSelected = day.isoDate === selected;
          return (
            <button
              key={day.isoDate}
              type="button"
              aria-pressed={isSelected}
              aria-controls={`home-day-panel-${day.isoDate}`}
              aria-label={chipLabel(day)}
              onClick={() => setSelected(day.isoDate)}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center rounded-[10px] border px-0 py-1.5 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                isSelected
                  ? 'border-[var(--field-selected-border)] bg-[var(--brand-tint)] text-[var(--field-selected-text)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'
              } ${day.isToday ? 'shadow-[inset_0_-2px_0_var(--brand)]' : ''}`}
            >
              <span>{day.label}</span>
              <span className={`data text-[15px] font-medium leading-tight ${isSelected ? 'text-[var(--field-selected-text)]' : 'text-[var(--text)]'}`}>{day.dateLabel}</span>
              <span aria-hidden="true" className="mt-1 flex min-h-1.5 max-w-[33px] flex-wrap items-center justify-center gap-[3px]">
                {day.marks.map((state, index) => (
                  <span
                    key={index}
                    className="size-1.5 rounded-full"
                    style={state === 'planned' ? { boxShadow: 'inset 0 0 0 1.25px var(--text-muted)' } : { background: complianceColors[state] }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="ink-week-track grid gap-2 md:grid-cols-4 md:items-start xl:grid-cols-7">
        {days.map((day) => (
          <div key={day.isoDate} id={`home-day-panel-${day.isoDate}`} className={`min-w-0 ${day.isoDate === selected ? '' : 'max-md:hidden'}`}>
            {day.panel}
          </div>
        ))}
      </div>
    </div>
  );
}
