'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Badge, Surface } from '@/components/ui';
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

type AthleteWeekViewProps = {
  weeklyNote: string | null;
  weekStart: Date;
  days: Day[];
  todayIndex: number;
};

export function AthleteWeekView({ weeklyNote, weekStart, days, todayIndex }: AthleteWeekViewProps) {
  const [selectedIndex, setSelectedIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const selectedDay = days[selectedIndex];

  return (
    <>
      <Surface>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Weekly note</p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Week of {format(weekStart, 'd MMM yyyy')}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              {weeklyNote || 'No weekly note added yet.'}
            </p>
          </div>
          <Badge tone="brand">Done + notes</Badge>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {days.map((day, index) => {
            const isSelected = index === selectedIndex;
            const isToday = index === todayIndex;

            return (
              <button
                key={day.fullLabel}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className="group relative cursor-pointer rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-px hover:scale-[1.02] active:scale-[0.99]"
                style={
                  isToday
                    ? {
                        background: isSelected
                          ? 'linear-gradient(160deg, rgba(90,124,255,0.22) 0%, rgba(90,124,255,0.09) 100%)'
                          : 'linear-gradient(160deg, rgba(90,124,255,0.15) 0%, rgba(90,124,255,0.05) 100%)',
                        borderColor: isSelected ? 'rgba(90,124,255,0.7)' : 'rgba(90,124,255,0.5)',
                        boxShadow: isSelected
                          ? '0 0 0 1px rgba(90,124,255,0.3), 0 0 20px rgba(90,124,255,0.25)'
                          : '0 0 0 1px rgba(90,124,255,0.18), 0 0 14px rgba(90,124,255,0.18)',
                      }
                    : isSelected
                      ? { borderColor: 'rgba(90,124,255,0.5)', background: 'rgba(90,124,255,0.16)' }
                      : { borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)' }
                }
              >
                {/* hover brightness overlay — works regardless of inline styles */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-white/0 transition-colors duration-150 group-hover:bg-white/[0.05]" />

                <div className="relative flex items-center justify-between gap-2">
                  <div>
                    <p className={`flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] ${isToday ? 'text-[#a5b4fc]' : 'text-slate-400'}`}>
                      {isToday && (
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#818cf8]"
                          style={{ boxShadow: '0 0 5px rgba(129,140,248,0.9)' }}
                        />
                      )}
                      {isToday ? `${day.shortLabel} - Today` : day.shortLabel}
                    </p>
                    <p className={`mt-1 text-xl font-semibold ${isSelected || isToday ? 'text-white' : 'text-slate-200'}`}>
                      {day.dayNumber}
                    </p>
                  </div>
                  <Badge tone={day.sessions.length > 0 ? 'brand' : 'neutral'}>
                    {day.sessions.length}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      </Surface>

      <Surface>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {selectedDay.shortLabel}
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">{selectedDay.fullLabel}</h3>
          </div>
          <Badge tone={selectedDay.sessions.length > 0 ? 'brand' : 'neutral'}>
            {selectedDay.sessions.length}{' '}
            {selectedDay.sessions.length === 1 ? 'session' : 'sessions'}
          </Badge>
        </div>

        <div className="mt-4 space-y-4">
          {selectedDay.sessions.length > 0 ? (
            selectedDay.sessions.map((session) => (
              <AthleteCompletionCard key={session.id} session={session} />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
              No session scheduled for this day.
            </div>
          )}
        </div>
      </Surface>
    </>
  );
}
