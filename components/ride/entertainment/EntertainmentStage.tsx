'use client';

import { lazy, Suspense, useState } from 'react';
import { Bike, Clapperboard, X } from 'lucide-react';
import { buttonFocusClassName } from '@/components/ui';
import { EntertainmentErrorBoundary } from './EntertainmentErrorBoundary';
import type { EntertainmentMode, EntertainmentRide } from './types';
import type { IncomingYouTubeVideo } from './youtube/use-youtube-inbox';

/** What the YouTube view gets from the ride screen besides the ride: videos brought in from outside Tempo. */
export type YouTubeInbox = {
  incoming: IncomingYouTubeVideo | null;
  onIncomingTaken: (seq: number) => void;
  dragActive: boolean;
};

// Loaded only when a rider turns a view on, so the ride screen stays light without them.
const loadYouTube = () => import('./YouTubePanel').then((module) => ({ default: module.YouTubePanel }));
const loadCourse = () => import('./CourseView').then((module) => ({ default: module.CourseView }));
const loading = <div className="h-full w-full animate-pulse rounded-xl bg-[var(--raised)]" />;

/** The chosen view. Its code loads lazily, afresh on each mount, so Try again retries a failed load. */
function EntertainmentView({ mode, ride, inbox }: { mode: EntertainmentMode; ride: EntertainmentRide; inbox: YouTubeInbox }) {
  const [YouTubePanel] = useState(() => lazy(loadYouTube));
  const [CourseView] = useState(() => lazy(loadCourse));
  return (
    <Suspense fallback={loading}>
      {mode === 'youtube'
        ? (
          <YouTubePanel
            sessionId={ride.sessionId}
            userId={ride.userId}
            status={ride.status}
            obscured={ride.obscured}
            incoming={inbox.incoming}
            onIncomingTaken={inbox.onIncomingTaken}
            dragActive={inbox.dragActive}
          />
        )
        : <CourseView ride={ride} />}
    </Suspense>
  );
}

const MODES: { id: EntertainmentMode; label: string; short: string; description: string; Icon: typeof Clapperboard }[] = [
  { id: 'youtube', label: 'YouTube', short: 'YouTube', description: 'Pick a video on YouTube and watch it here, with your stats beside the player.', Icon: Clapperboard },
  { id: 'course', label: 'Ride a course', short: 'Course', description: 'A rider on a hilly loop. Your watts set the speed, and climbs slow you down.', Icon: Bike },
];

/**
 * The middle area of the ride screen when entertainment is on: a view picker, then the chosen view.
 * Phones get the course only (`allowYouTube` false): the screen is too small for a player beside the stats.
 */
export function EntertainmentStage({ mode, ride, inbox, onModeChange, onClose, compact = false, allowYouTube = true }: {
  mode: EntertainmentMode | null;
  ride: EntertainmentRide;
  inbox: YouTubeInbox;
  onModeChange: (mode: EntertainmentMode) => void;
  onClose: () => void;
  compact?: boolean;
  allowYouTube?: boolean;
}) {
  const modes = allowYouTube ? MODES : MODES.filter(({ id }) => id !== 'youtube');
  return (
    <section aria-label="Entertainment" className={`flex h-full min-h-0 w-full flex-col ${compact ? 'gap-1.5' : 'gap-2'}`}>
      <div className="flex shrink-0 items-center gap-2">
        {modes.length > 1 ? (
          <div role="tablist" aria-label="Entertainment view" className="flex rounded-lg border border-[var(--border)] p-0.5">
            {modes.map(({ id, short, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors ${buttonFocusClassName} ${mode === id ? 'bg-[var(--raised)] text-[var(--text)]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
                onClick={() => onModeChange(id)}
              >
                <Icon aria-hidden="true" size={14} strokeWidth={1.8} />{short}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[13px] font-medium text-[var(--text-secondary)]">{modes[0].label}</p>
        )}
        <button
          type="button"
          className={`ml-auto inline-flex size-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)] ${buttonFocusClassName}`}
          aria-label="Turn off entertainment"
          title="Turn off entertainment (V)"
          onClick={onClose}
        >
          <X aria-hidden="true" size={16} strokeWidth={1.8} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        {mode ? (
          <EntertainmentErrorBoundary key={mode} onTurnOff={onClose}>
            <EntertainmentView mode={mode} ride={ride} inbox={inbox} />
          </EntertainmentErrorBoundary>
        ) : (
          <div className={`grid h-full content-center gap-3 ${compact ? 'grid-cols-1' : 'mx-auto max-w-3xl sm:grid-cols-2'}`}>
            {modes.map(({ id, label, description, Icon }) => (
              <button
                key={id}
                type="button"
                className={`group flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left transition-colors hover:border-[var(--brand)] ${compact ? 'p-3' : 'flex-col p-6'} ${buttonFocusClassName}`}
                onClick={() => onModeChange(id)}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--raised)] text-[var(--brand)]"><Icon aria-hidden="true" size={20} strokeWidth={1.7} /></span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-[var(--text)]">{label}</span>
                  <span className="mt-1 block text-[13px] leading-snug text-[var(--text-secondary)]">{description}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
