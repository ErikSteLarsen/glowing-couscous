'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { compactSecondaryButtonClassName, Disclosure, ghostButtonClassName } from '@/components/ui';
import { formatSessionWhen } from '@/lib/session-display';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { SessionRescheduleAction } from './SessionRescheduleAction';

type OverdueSession = {
  id: number;
  title: string;
  sport: string;
  status: string;
  hasSteps: boolean;
  date: Date;
  timeLabel: string | null;
  durationSec: number;
};

export function OverdueSessions({ sessions, today }: { sessions: OverdueSession[]; today: string }) {
  const [feedback, setFeedback] = useState('');
  const newest = sessions[0];
  if (!newest && !feedback) return null;

  return (
    <div className="space-y-2">
      {feedback ? <p role="status" className="text-sm text-[var(--status-success)]">{feedback}</p> : null}
      {newest ? (
        <Disclosure summary={(
          <span className="min-w-0">
            <span className="block">See missed workouts ({sessions.length})</span>
            <span className="block text-[13px] font-normal text-[var(--text-muted)]">Latest · {newest.title}</span>
          </span>
        )}>
          <ul className="divide-y divide-[var(--border)]">
            {sessions.map((session) => (
              <li key={session.id} className="flex min-w-0 flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
                <Link href={`/athlete/session/${session.id}?from=home`} className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
                  <span className="block text-sm font-medium text-[var(--text)]">{session.title}</span>
                  <span className="mt-1 block text-xs text-[var(--text-muted)]">
                    {formatSessionWhen(session.date, session.timeLabel)} · {getSportLabel(session.sport)} · {formatDuration(session.durationSec)}
                  </span>
                </Link>
                <div className="flex flex-wrap items-start gap-2">
                  <WorkoutStartChooser
                    workout={session}
                    source={{ kind: 'session', id: session.id, from: 'home' }}
                    triggerClassName={`${compactSecondaryButtonClassName} min-h-10 max-md:min-h-11`}
                  />
                  <SessionRescheduleAction
                    mode="quick"
                    sessionId={session.id}
                    title={session.title}
                    targetDay={today}
                    onMoved={(title) => setFeedback(`Moved ${title} to today.`)}
                  />
                </div>
              </li>
            ))}
          </ul>
          <Link href="/athlete/calendar" className={`${ghostButtonClassName('compact')} max-md:min-h-11`}>Calendar</Link>
        </Disclosure>
      ) : null}
    </div>
  );
}
