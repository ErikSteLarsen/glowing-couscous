'use client';

import type { EntertainmentRide } from './types';

/** Placeholder: YouTube browse and watch view. Replaced by the YouTube implementation. */
export function YouTubePanel({ ride }: { ride: EntertainmentRide }) {
  return <div className="grid h-full place-items-center text-sm text-[var(--text-secondary)]">YouTube ({ride.status})</div>;
}
