'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { ghostButtonClassName, sectionHeadingClassName } from '@/components/ui';
import { formatSessionWhen } from '@/lib/session-display';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { SessionRescheduleAction } from './SessionRescheduleAction';

type OverdueSession = {
  id: number;
  title: string;
  sport: string;
  date: Date;
  timeLabel: string | null;
  durationSec: number;
};

export function OverdueSessions({ sessions, today }: { sessions: OverdueSession[]; today: string }) {
  const [feedback, setFeedback] = useState('');
  if (sessions.length === 0 && !feedback) return null;

  return (
    <section aria-labelledby="overdue-sessions-heading" className="tile space-y-3 rounded-2xl p-5 xl:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="overdue-sessions-heading" className={sectionHeadingClassName}>Missed sessions</h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">Start one now or move it to another day.</p>
        </div>
        <Link href="/athlete/calendar" className={`${ghostButtonClassName('compact')} min-h-11`}>Calendar</Link>
      </div>
      {feedback ? <p role="status" aria-live="polite" className="text-sm text-[var(--status-success)]">{feedback}</p> : null}
      {sessions.length > 0 ? (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href={`/athlete/session/${session.id}?from=home`} className="min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
                <span className="block truncate text-sm font-medium text-[var(--text)]">{session.title}</span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  {formatSessionWhen(session.date, session.timeLabel)} · {getSportLabel(session.sport)} · {formatDuration(session.durationSec)}
                </span>
              </Link>
              <div className="flex flex-wrap gap-2">
                <Link href={`/athlete/live/${session.id}?from=home`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--signal-ink)] hover:bg-[var(--signal-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]">
                  <Play aria-hidden="true" size={15} strokeWidth={1.8} />
                  Start now
                </Link>
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
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">All caught up. You can plan your next session when you’re ready.</p>
      )}
    </section>
  );
}
