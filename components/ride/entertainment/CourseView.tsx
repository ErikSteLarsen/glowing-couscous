'use client';

import type { EntertainmentRide } from './types';

/** Placeholder: virtual course with a stick-figure rider. Replaced by the course implementation. */
export function CourseView({ ride }: { ride: EntertainmentRide }) {
  return <div className="grid h-full place-items-center text-sm text-[var(--text-secondary)]">Course ({ride.status})</div>;
}
