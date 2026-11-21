'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, Ellipsis, Plus } from 'lucide-react';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempo/Menu';
import { ghostButtonClassName, iconButtonClassName, secondaryButtonClassName } from '@/components/ui';
import { withBackOrigin } from '@/lib/app-navigation';

type Status = { kind: 'idle' } | { kind: 'pending' } | { kind: 'done'; sessionId: string } | { kind: 'error'; message: string };

function newRequestKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

/** Start workout and Schedule stay visible; saving a reusable copy lives in ⋯. */
export function LibraryWorkoutActions({ slug, name, durationSec, hasSteps, from }: { slug: string; name: string; durationSec: number; hasSteps: boolean; from: 'library' | 'ride' }) {
  // One key per page view: a retry after a lost response replays the first save instead of adding a copy.
  const [saveKey] = useState(newRequestKey);
  const [save, setSave] = useState<Status>({ kind: 'idle' });
  const scheduleHref = withBackOrigin(`/athlete/library/${encodeURIComponent(slug)}/schedule`, from);

  async function addToWorkouts() {
    setSave({ kind: 'pending' });
    try {
      const response = await fetch(`/api/athlete/library/${encodeURIComponent(slug)}/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestKey: saveKey }),
      });
      const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Could not save. Try again.');
      setSave({ kind: 'done', sessionId: String(payload?.sessionId) });
    } catch (error) {
      setSave({ kind: 'error', message: error instanceof TypeError || !(error instanceof Error) ? 'Could not save. Try again.' : error.message });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <WorkoutStartChooser
          workout={{ title: name, durationSec, sport: 'BIKING', status: 'planned', hasSteps }}
          source={{ kind: 'catalog', slug, from }}
        />
        <Link href={scheduleHref} className={secondaryButtonClassName}>
          <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.6} />Schedule
        </Link>
        <Menu>
          <MenuTrigger aria-label={`More actions for ${name}`} className={iconButtonClassName}>
            <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem disabled={save.kind === 'pending' || save.kind === 'done'} onSelect={() => void addToWorkouts()}>
              <Plus aria-hidden="true" size={16} strokeWidth={1.6} />
              {save.kind === 'pending' ? 'Saving…' : save.kind === 'done' ? 'In your workouts' : 'Add to my workouts'}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>

      <div aria-live="polite" className="flex flex-col gap-1 empty:hidden">
        {save.kind === 'error' ? <p role="alert" className="text-sm text-[var(--status-danger)]">{save.message}</p> : null}
        {save.kind === 'done' ? (
          <p className="inline-flex flex-wrap items-center gap-x-2 text-sm text-[var(--status-success)]">
            Saved to your workouts.
            <Link href={`/athlete/workouts?edit=${save.sessionId}`} className={`${ghostButtonClassName('compact')} -my-1`}>Edit copy</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
