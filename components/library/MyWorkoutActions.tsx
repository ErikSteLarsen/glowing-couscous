'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Ellipsis, Link2, Pencil, Trash2 } from 'lucide-react';
import { ShareLinkResult, useShareLink } from '@/components/ShareLinkButton';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempo/Menu';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { dangerTextClassName, iconButtonClassName, secondaryButtonClassName } from '@/components/ui';
import { startTriggerClassName } from '@/components/library/LibraryWorkoutActions';
import { editWorkoutHref, myWorkoutsHref } from '@/lib/athlete-workouts-navigation';
import { getCalendarPlacementHref } from '@/lib/calendar-navigation';

type Share = ReturnType<typeof useShareLink>;

export function myWorkoutScheduleHref(id: number) {
  return getCalendarPlacementHref(`workout:${id}`);
}

export function confirmDeleteWorkout(title: string) {
  const workoutName = title.trim() || 'this workout';
  return window.confirm(`Delete "${workoutName}" from My workouts? This can’t be undone. Workouts already on your Calendar stay.`);
}

/**
 * The ⋯ menu for a saved workout: the owned counterpart of `LibraryWorkoutMenu`.
 * Edit replaces Customize; share link and delete exist only for workouts you own.
 */
export function MyWorkoutMenu({ id, name, share, disabled = false, onEdit, onDelete, showEdit = true, showSchedule = false }: {
  id: number;
  name: string;
  share: Share;
  disabled?: boolean;
  /** Opens the editor in place; without it, Edit links to the editor page. */
  onEdit?: () => void;
  onDelete: () => void;
  showEdit?: boolean;
  showSchedule?: boolean;
}) {
  return (
    <Menu>
      <MenuTrigger disabled={share.isPending || disabled} aria-label={`More options for ${name}`} className={`${iconButtonClassName} max-md:size-11`}>
        <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
      </MenuTrigger>
      <MenuContent align="end">
        {showEdit ? (
          onEdit
            ? <MenuItem onSelect={onEdit}><Pencil aria-hidden="true" size={16} strokeWidth={1.6} />Edit</MenuItem>
            : <MenuItem render={<Link href={editWorkoutHref(id)} prefetch={false} />}><Pencil aria-hidden="true" size={16} strokeWidth={1.6} />Edit</MenuItem>
        ) : null}
        {showSchedule ? (
          <MenuItem render={<Link href={myWorkoutScheduleHref(id)} prefetch={false} />}>
            <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.6} />Schedule
          </MenuItem>
        ) : null}
        <MenuItem onSelect={share.createLink}>
          <Link2 aria-hidden="true" size={16} strokeWidth={1.8} />Create share link
        </MenuItem>
        <MenuItem destructive onSelect={onDelete}>
          <Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />Delete workout…
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Detail page actions, laid out like `LibraryWorkoutActions`: Start workout, Schedule, Edit and ⋯. */
export function MyWorkoutActions({ id, name, sport, durationSec, hasSteps }: { id: number; name: string; sport: string; durationSec: number; hasSteps: boolean }) {
  const router = useRouter();
  const share = useShareLink('session', id);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function deleteWorkout() {
    if (!confirmDeleteWorkout(name)) return;
    setError('');
    startTransition(async () => {
      try {
        const response = await fetch(`/api/athlete/workouts/${id}`, { method: 'DELETE' });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) {
          setError(payload.error ?? 'Could not delete this workout. Try again.');
          return;
        }
        router.replace(myWorkoutsHref());
        router.refresh();
      } catch {
        setError('Could not reach Tempo. Check your connection and try again.');
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <WorkoutStartChooser
          workout={{ title: name, durationSec, sport, status: 'planned', hasSteps }}
          source={{ kind: 'workout', id, from: null }}
          triggerClassName={startTriggerClassName}
        />
        <Link href={myWorkoutScheduleHref(id)} className={`${secondaryButtonClassName} max-md:min-h-11`}>
          <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.6} />Schedule
        </Link>
        <Link href={editWorkoutHref(id, 'detail')} className={`${secondaryButtonClassName} max-md:min-h-11`}>
          <Pencil aria-hidden="true" size={16} strokeWidth={1.6} />Edit
        </Link>
        <MyWorkoutMenu id={id} name={name} share={share} disabled={isPending} showEdit={false} onDelete={deleteWorkout} />
      </div>
      {isPending ? <p role="status" className="text-sm text-[var(--text-secondary)]">Deleting workout…</p> : null}
      {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
      {share.message || share.shareUrl ? <div className="max-w-xl space-y-2"><ShareLinkResult share={share} showAudience /></div> : null}
    </div>
  );
}
