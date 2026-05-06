'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui';
import { AthleteCompletionCard } from '@/components/AthleteCompletionCard';

type Session = {
  id: number;
  title: string;
  summary: string | null;
  sportType: string;
  durationMinutes: number | null;
  intensity: string | null;
  scheduledDate: Date;
  blocks: Array<{
    id: number;
    blockType: string;
    title: string;
    instructions: string | null;
  }>;
  completion: {
    isDone: boolean;
    notes: string | null;
    completedAt: Date | null;
  } | null;
};

type Day = {
  date: Date;
  shortLabel: string;
  dayNumber: string;
  fullLabel: string;
  sessions: Session[];
};

type AthleteDayListProps = {
  days: Day[];
  todayIndex: number;
};

export function AthleteDayList({ days, todayIndex }: AthleteDayListProps) {
  const defaultOpen = todayIndex >= 0 ? todayIndex : 0;
  const [expandedIndex, setExpandedIndex] = useState(defaultOpen);

  function toggle(index: number) {
    setExpandedIndex((prev) => (prev === index ? -1 : index));
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[rgba(17,24,39,0.78)] shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
      {days.map((day, index) => {
        const isExpanded = expandedIndex === index;
        const isToday = index === todayIndex;

        return (
          <div
            key={day.fullLabel}
            className={index > 0 ? 'border-t border-white/[0.07]' : ''}
          >
            <button
              type="button"
              onClick={() => toggle(index)}
              className={`group flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-150 ${
                isExpanded
                  ? 'bg-[rgba(90,124,255,0.07)]'
                  : 'hover:bg-white/[0.025]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 shrink-0">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${
                      isToday ? 'text-[var(--color-brand-100,#a5b4fc)]' : 'text-slate-500'
                    }`}
                  >
                    {day.shortLabel}
                  </p>
                  <p
                    className={`mt-0.5 text-2xl font-semibold leading-none ${
                      isToday ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    {day.dayNumber}
                  </p>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-medium ${
                        isExpanded ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {day.fullLabel}
                    </p>
                    {isToday && (
                      <span className="rounded-full bg-[rgba(90,124,255,0.2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-brand-100,#a5b4fc)]">
                        Today
                      </span>
                    )}
                  </div>
                  {day.sessions.length > 0 && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {day.sessions.map((s) => s.title).join(' · ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Badge tone={day.sessions.length > 0 ? 'brand' : 'neutral'}>
                  {day.sessions.length}{' '}
                  {day.sessions.length === 1 ? 'session' : 'sessions'}
                </Badge>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 ease-in-out ${
                    isExpanded ? 'rotate-180 text-slate-300' : ''
                  }`}
                />
              </div>
            </button>

            <div
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <div className="space-y-4 px-5 pb-5 pt-1">
                  {day.sessions.length > 0 ? (
                    day.sessions.map((session) => (
                      <AthleteCompletionCard key={session.id} session={session} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-400">
                      No session scheduled for this day.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
