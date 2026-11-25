'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, CircleSlash, Download, Ellipsis, Link2, PencilLine, SquarePen, Trash2 } from 'lucide-react';
import { SessionDeleteAction } from '@/components/SessionDeleteAction';
import { SessionRescheduleAction } from '@/components/SessionRescheduleAction';
import { ShareLinkResult, useShareLink } from '@/components/ShareLinkButton';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/tempo/Menu';
import { dangerTextClassName, iconButtonClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import { SessionStatusMessage, useSessionStatusAction, type SessionStatusAction } from './SessionStatusControl';

const AdjustRequestContext = createContext<{ request: number; requestAdjust: () => void }>({ request: 0, requestAdjust: () => undefined });

/** Lets the header ⋯ menu open the planned-adjustment editor that lives in the completion section. */
export function SessionAdjustProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState(0);
  return (
    <AdjustRequestContext.Provider value={{ request, requestAdjust: () => setRequest((count) => count + 1) }}>
      {children}
    </AdjustRequestContext.Provider>
  );
}

export function useAdjustRequest() {
  return useContext(AdjustRequestContext).request;
}

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Header link to the completion form. The form sits beside the overview on wide screens
 * and under it on narrow ones, so this scrolls to it and moves focus into the note.
 * Without JavaScript the hash link still jumps to the section.
 */
export function LogCompletionLink({ tone }: { tone: 'primary' | 'secondary' }) {
  return (
    <a
      href="#session-outcome"
      className={tone === 'primary' ? primaryButtonClassName : secondaryButtonClassName}
      onClick={(event) => {
        const section = document.getElementById('session-outcome');
        if (!section) return;
        event.preventDefault();
        section.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        const field = section.querySelector<HTMLElement>('#session-notes') ?? section;
        if (field === section) section.setAttribute('tabindex', '-1');
        field.focus({ preventScroll: true });
        window.history.replaceState(null, '', '#session-outcome');
      }}
    >
      Mark as done
    </a>
  );
}

/**
 * The session's visible main action plus one ⋯ menu for everything else it allows.
 * Each menu entry is passed only when the server's rights rules allow it.
 */
export function SessionHeaderActions({
  sessionId,
  title,
  primary,
  shareable,
  canAdjust,
  sourceWorkoutId,
  move,
  statusAction,
  canDelete,
  returnHref,
  downloadTcxHref = null,
  deleteActivityId = null,
}: {
  sessionId: number;
  title: string;
  primary?: ReactNode;
  shareable: boolean;
  canAdjust: boolean;
  sourceWorkoutId: number | null;
  move: { currentDay: string; today: string } | null;
  statusAction: SessionStatusAction | null;
  canDelete: boolean;
  returnHref: string;
  /** The recorded data as a .tcx file, for uploading to Strava or another app by hand. */
  downloadTcxHref?: string | null;
  /** An unplanned recorded ride, which deleting removes from the Calendar too. */
  deleteActivityId?: number | null;
}) {
  const { requestAdjust } = useContext(AdjustRequestContext);
  const share = useShareLink('session', sessionId);
  const status = useSessionStatusAction(sessionId);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canSkip = statusAction === 'skip';
  const hasMenu = canAdjust || Boolean(move) || canSkip || sourceWorkoutId !== null || shareable || canDelete || Boolean(downloadTcxHref) || deleteActivityId !== null;
  const router = useRouter();
  const [deleteError, setDeleteError] = useState('');

  async function deleteRide() {
    if (!window.confirm('Delete this ride? It’s removed from your Calendar and activities. This cannot be undone.')) return;
    setDeleteError('');
    const response = await fetch(`/api/activity-imports/${deleteActivityId}`, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      setDeleteError('Could not delete this ride. Try again.');
      return;
    }
    router.replace(returnHref);
    router.refresh();
  }

  function adjust() {
    requestAdjust();
    requestAnimationFrame(() => document.getElementById('session-outcome')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }));
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <div className="flex flex-wrap items-center gap-2 max-md:[&>:is(a,button)]:min-h-11">
        {primary}
        {statusAction === 'plan-again' ? (
          <button type="button" className={secondaryButtonClassName} disabled={status.isPending} onClick={() => status.run('plan-again')}>
            {status.isPending ? 'Saving…' : 'Plan again'}
          </button>
        ) : null}
        {hasMenu ? (
          <Menu>
            <MenuTrigger aria-label={`More actions for ${title}`} className={iconButtonClassName} disabled={status.isPending || share.isPending}>
              <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
            </MenuTrigger>
            <MenuContent align="end">
              {canAdjust ? (
                <MenuItem onSelect={adjust}>
                  <SquarePen aria-hidden="true" size={16} strokeWidth={1.6} />Change this workout
                </MenuItem>
              ) : null}
              {move ? (
                <MenuItem onSelect={() => setMoveOpen(true)}>
                  <CalendarClock aria-hidden="true" size={16} strokeWidth={1.6} />Move to another day…
                </MenuItem>
              ) : null}
              {canSkip ? (
                <MenuItem onSelect={() => status.run('skip')}>
                  <CircleSlash aria-hidden="true" size={16} strokeWidth={1.6} />Skip workout
                </MenuItem>
              ) : null}
              {sourceWorkoutId !== null ? (
                <MenuItem render={<Link href={`/athlete/workouts?edit=${sourceWorkoutId}`} />}>
                  <PencilLine aria-hidden="true" size={16} strokeWidth={1.6} />Edit original workout
                </MenuItem>
              ) : null}
              {shareable ? (
                <MenuItem onSelect={share.createLink}>
                  <Link2 aria-hidden="true" size={16} strokeWidth={1.6} />Create share link
                </MenuItem>
              ) : null}
              {downloadTcxHref ? (
                <MenuItem render={<a href={downloadTcxHref} download />}>
                  <Download aria-hidden="true" size={16} strokeWidth={1.6} />Download .tcx file
                </MenuItem>
              ) : null}
              {deleteActivityId !== null ? (
                <>
                  <MenuSeparator />
                  <MenuItem destructive onSelect={() => void deleteRide()}>
                    <Trash2 aria-hidden="true" size={16} strokeWidth={1.6} />Delete ride
                  </MenuItem>
                </>
              ) : null}
              {canDelete ? (
                <>
                  <MenuSeparator />
                  <MenuItem destructive onSelect={() => setDeleteOpen(true)}>
                    <Trash2 aria-hidden="true" size={16} strokeWidth={1.6} />Remove from Calendar
                  </MenuItem>
                </>
              ) : null}
            </MenuContent>
          </Menu>
        ) : null}
      </div>
      <div aria-live="polite" className="flex max-w-md flex-col gap-2 empty:hidden sm:items-end sm:text-right">
        <SessionStatusMessage status={status} />
        {deleteError ? <p role="alert" className={dangerTextClassName}>{deleteError}</p> : null}
        <ShareLinkResult share={share} showAudience />
        {move ? (
          <SessionRescheduleAction mode="dialog" sessionId={sessionId} title={title} currentDay={move.currentDay} today={move.today} open={moveOpen} onOpenChange={setMoveOpen} />
        ) : null}
      </div>
      {canDelete ? <SessionDeleteAction sessionId={sessionId} title={title} returnHref={returnHref} open={deleteOpen} onOpenChange={setDeleteOpen} /> : null}
    </div>
  );
}
