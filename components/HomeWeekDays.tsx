'use client';

import { useState, type ReactNode } from 'react';
import { complianceColors } from '@/components/wattonaut/ComplianceMark';
import type { ComplianceState } from '@/lib/training-load';

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

const MAX_CHIP_DOTS = 4;

function chipLabel(day: HomeWeekDay): string {
  const count = day.marks.length;
  const workouts = count === 0 ? 'rest' : `${count} ${count === 1 ? 'workout' : 'workouts'}`;
  return `${day.longLabel}${day.isToday ? ', today' : ''}, ${workouts}`;
}

/** Shows up to four dots; more workouts show three dots and a "+N" count. */
function splitChipDots(marks: ComplianceState[]): { dots: ComplianceState[]; hiddenCount: number } {
  if (marks.length <= MAX_CHIP_DOTS) return { dots: marks, hiddenCount: 0 };
  const dots = marks.slice(0, MAX_CHIP_DOTS - 1);
  return { dots, hiddenCount: marks.length - dots.length };
}

/**
 * Home's week. Phones show seven day chips and only the selected day's
 * workouts, starting on today; wider screens show every day as a column.
 */
export function HomeWeekDays({ days }: { days: HomeWeekDay[] }) {
  const [selected, setSelected] = useState(() => (days.find((day) => day.isToday) ?? days[0])?.isoDate);

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-7 gap-1 md:hidden" role="group" aria-label="Choose a day">
        {days.map((day) => {
          const isSelected = day.isoDate === selected;
          const { dots, hiddenCount } = splitChipDots(day.marks);
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
                  ? 'border-[var(--field-selected-border)] bg-[var(--brand-tint)] text-[var(--brand)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]'
              } ${day.isToday ? 'shadow-[inset_0_-2px_0_var(--brand)]' : ''}`}
            >
              <span>{day.label}</span>
              <span className={`data text-[15px] font-medium leading-tight ${isSelected ? 'text-[var(--brand)]' : 'text-[var(--text)]'}`}>{day.dateLabel}</span>
              <span aria-hidden="true" className="mt-1 flex h-1.5 items-center gap-[3px]">
                {dots.map((state, index) => (
                  <span
                    key={index}
                    className="size-1.5 rounded-full"
                    style={state === 'planned' ? { boxShadow: 'inset 0 0 0 1.25px var(--text-muted)' } : { background: complianceColors[state] }}
                  />
                ))}
                {hiddenCount > 0 ? <span className="text-[9px] leading-none text-[var(--text-muted)]">+{hiddenCount}</span> : null}
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
