'use client';

import { lazy, Suspense, useState } from 'react';
import { EntertainmentErrorBoundary } from './EntertainmentErrorBoundary';
import type { EntertainmentMode, EntertainmentRide, TrackActivity } from './types';
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

type ViewProps = { mode: EntertainmentMode; ride: EntertainmentRide; inbox: YouTubeInbox; trackActivity: TrackActivity };

/** The chosen view. Its code loads lazily, afresh on each mount, so Try again retries a failed load. */
function EntertainmentView({ mode, ride, inbox, trackActivity }: ViewProps) {
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
            trackActivity={trackActivity}
          />
        )
        : <CourseView ride={ride} trackActivity={trackActivity} />}
    </Suspense>
  );
}

/** The middle area of the ride screen while entertainment is on. The header chooses the view. */
export function EntertainmentStage({ mode, ride, inbox, trackActivity, onClose }: ViewProps & { onClose: () => void }) {
  return (
    <section aria-label="Entertainment" className="relative h-full min-h-0 w-full">
      <EntertainmentErrorBoundary key={mode} onTurnOff={onClose}>
        <EntertainmentView mode={mode} ride={ride} inbox={inbox} trackActivity={trackActivity} />
      </EntertainmentErrorBoundary>
    </section>
  );
}
