'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { WorkoutBuilder } from '@/components/WorkoutBuilder';
import { formatWorkoutTarget } from '@/lib/workout-target-resolution';
import {
  Badge,
  compactSecondaryButtonClassName,
  dangerButtonClassName,
  dangerTextClassName,
  formFieldClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  Surface,
  successTextClassName,
  PageShell,
  TopBar,
} from '@/components/ui';
import { formatDuration } from '@/lib/format-duration';
import { createPlannerEditorDraftFromSharedProjection } from '@/lib/session-editor-adapters';
import {
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
  type SessionEditorDraft,
} from '@/lib/session-editor';
import {
  createSessionEditorDraftFromSharedProjection,
  createSharePath,
  type SharedWorkoutProjection,
  type ShareLinkAction,
} from '@/lib/share-link';
import type { AppRole } from '@/lib/app-navigation';
import { getSportLabel } from '@/lib/sport';
import type { PerformanceProfile } from '@/lib/performance-profile';
import { getCalendarPlacementHref } from '@/lib/calendar-navigation';

// Athletes add a shared workout to their Calendar (a copy in My workouts, placed
// with the Calendar's Add workout dialog), save it to My workouts after editing,
// or save it as a training plan. Coaches save it to Workouts (`planner`). Only
// `planner` is a continuable sign-in action (see lib/share-link.ts).
type ShareCopyAction = ShareLinkAction | 'library' | 'template';

export function ShareLandingClient({
  token,
  projection,
  isSignedIn,
  userRole,
  initialAction,
  performanceProfile = null,
  ownerDeleted = false,
}: {
  token: string;
  projection: SharedWorkoutProjection;
  isSignedIn: boolean;
  userRole: AppRole | null;
  initialAction: ShareLinkAction | null;
  performanceProfile?: PerformanceProfile | null;
  ownerDeleted?: boolean;
}) {
  const router = useRouter();
  // Athletes come back from sign-in to the preview and choose Add to Calendar there.
  const availableInitialAction: ShareCopyAction | null = initialAction && isSignedIn && userRole === 'COACH' ? initialAction : null;
  const [action, setAction] = useState<ShareCopyAction | null>(availableInitialAction);
  const [draft, setDraft] = useState<SessionEditorDraft>(() => createInitialDraft(projection, userRole, availableInitialAction));
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const plannerDestination = userRole === 'COACH' ? 'Workouts' : 'Calendar';

  /** Sends a signed-out or unfinished account to sign in first; true when it can go on. */
  function ensureAccount(nextAction: ShareCopyAction) {
    const callbackPath = createSharePath(token, nextAction === 'planner' ? nextAction : undefined);
    if (!isSignedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
      return false;
    }
    if (!userRole) {
      router.push(`/setup?callbackUrl=${encodeURIComponent(callbackPath)}`);
      return false;
    }
    return true;
  }

  /**
   * Athletes: save the shared workout as it is to My workouts, then open the
   * Calendar's Add workout dialog on it. Cancel there comes back here.
   */
  function addToCalendar() {
    if (isPending || !ensureAccount('planner')) return;
    if (userRole === 'COACH') { beginAction('planner'); return; }
    startTransition(async () => {
      try {
        setMessage('');
        const response = await fetch('/api/share-links/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action: 'library', draft: serializeSessionEditorDraft(createSessionEditorDraftFromSharedProjection(projection)) }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string; sessionIds?: number[] };
        const workoutId = payload.sessionIds?.[0];
        if (!response.ok || !workoutId) {
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not add this workout. Try again.');
          return;
        }
        router.push(getCalendarPlacementHref(`workout:${workoutId}`, { back: createSharePath(token) }));
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach TempoBuilder. Check your connection and try again.');
      }
    });
  }

  function beginAction(nextAction: ShareCopyAction) {
    if (isPending || !ensureAccount(nextAction)) return;

    setAction(nextAction);
    setDraft(createInitialDraft(projection, userRole, nextAction));
    setMessage('');
    setIsDirty(false);
    setConfirmDiscard(false);
  }

  function closeEditor() {
    if (isPending) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    setAction(null);
    setMessage('');
  }

  function save() {
    if (!action || isPending) return;
    const validationError = validateSessionEditorDraft(draft);
    if (validationError) {
      setMessageTone('danger');
      setMessage(validationError);
      return;
    }

    startTransition(async () => {
      try {
        setMessage('');
        const response = await fetch('/api/share-links/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, action, draft: serializeSessionEditorDraft(draft) }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) {
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not save this workout. Try again.');
          return;
        }

        setMessageTone('success');
        setMessage(savedMessage(action, plannerDestination));
        router.push(savedDestination(action, userRole));
        router.refresh();
      } catch {
        setMessageTone('danger');
        setMessage('Could not reach TempoBuilder. Your changes are still here. Check your connection and save again.');
      }
    });
  }

  return (
    <main id="main">
      <PageShell size="wide" className="max-w-[1180px]">
        <TopBar
          title={projection.title || 'Shared workout'}
          description={ownerDeleted ? 'Shared by a deleted account. Anyone with the link can still see this workout.' : 'A view-only copy. Anyone with this link can see it.'}
        />

        {!action ? (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Surface className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone="brand">{getSportLabel(projection.sport)}</Badge>
                  <Badge>{formatDuration(projection.metrics.durationSec)}</Badge>
                  <Badge>{projection.metrics.tss}&nbsp;TSS</Badge>
                </div>
                <p className="text-[15px] leading-[1.6] text-[var(--text-secondary)]">
                  {projection.summary || 'A workout shared from TempoBuilder.'}
                </p>
                <div className="space-y-3">
                  <h2 className="text-base font-medium text-[var(--text)]">Blocks</h2>
                  {projection.blocks.map((block, index) => (
                    <div key={`${block.kind}-${index}`} className="rounded-[12px] border border-[var(--border)] bg-[var(--field-surface)] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold capitalize text-[var(--text)]">
                            {block.kind}{block.skipped ? ' – skipped' : ''}
                          </p>
                          {block.note ? <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{block.note}</p> : null}
                        </div>
                        <span className="text-[13px] font-medium text-[var(--text-secondary)]">
                          {formatDuration(block.durationSec)}{block.reps ? `\u00A0– ${block.reps} reps` : ''}
                        </span>
                      </div>
                      {block.target ? (
                        <p className="mt-3 text-[12px] text-[var(--text-secondary)]">
                          Target: {formatWorkoutTarget(block.target)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Surface>

              <Surface className="flex flex-col justify-between gap-6">
                <div>
                  <h2 className="text-base font-medium text-[var(--text)]">Save your own copy</h2>
                  <p className="mt-2 text-sm leading-[1.55] text-[var(--text-secondary)]">
                    {userRole === 'COACH' ? 'Pick one. You can edit the workout before anything is saved.' : 'Put it on a day in your Calendar, or edit your own copy first.'}
                  </p>
                </div>
                <div className="grid gap-3">
                  <button type="button" className={primaryButtonClassName} disabled={isPending} onClick={addToCalendar}>
                    {isPending ? 'Adding…' : `Add to ${plannerDestination}`}
                  </button>
                  {userRole !== 'COACH' ? <p className="-mt-1 text-[13px] text-[var(--text-muted)]">Saves a copy to My workouts and lets you pick the day.</p> : null}
                  {userRole === 'ATHLETE' ? (
                    <>
                      <button type="button" className={compactSecondaryButtonClassName} disabled={isPending} onClick={() => beginAction('library')}>
                        Edit and save to My workouts
                      </button>
                      <button type="button" className={compactSecondaryButtonClassName} disabled={isPending} onClick={() => beginAction('template')}>
                        Save as a training plan
                      </button>
                    </>
                  ) : null}
                  {message && messageTone === 'danger' ? <p role="alert" className={dangerTextClassName}>{message}</p> : null}
                </div>
              </Surface>
            </div>
          </>
        ) : (
          <Surface className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-medium text-[var(--text)]">
                  {editorTitle(action, plannerDestination)}
                </h2>
              </div>
              <button type="button" className={compactSecondaryButtonClassName} onClick={closeEditor} disabled={isPending}>
                Back to preview
              </button>
            </div>
            {confirmDiscard ? (
              <div role="alert" className="space-y-3 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] p-4">
                <p className="text-sm text-[var(--text)]">Discard your changes to this copy?</p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={secondaryButtonClassName} disabled={isPending} onClick={() => setConfirmDiscard(false)}>Keep editing</button>
                  <button type="button" className={dangerButtonClassName} disabled={isPending} onClick={() => { setAction(null); setIsDirty(false); setConfirmDiscard(false); setMessage(''); }}>Discard changes</button>
                </div>
              </div>
            ) : null}
            <fieldset disabled={isPending} className="min-w-0">
              <WorkoutBuilder
                key={action}
                draft={draft}
                onChange={(next) => { setDraft(next); setIsDirty(true); setMessage(''); }}
                showSchedule={action === 'planner' && userRole === 'ATHLETE'}
                summaryPlaceholder="Notes"
                performanceProfile={performanceProfile}
              />
            </fieldset>
            {action === 'planner' ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {userRole === 'COACH' ? 'This saves a private copy to your Workouts.' : 'This adds a private copy to your Calendar on the date you choose.'}
              </p>
            ) : null}
            <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3">
              <button type="button" className={primaryButtonClassName} onClick={save} disabled={isPending || confirmDiscard}>
                {isPending ? 'Saving…' : saveLabel(action, plannerDestination)}
              </button>
              {message ? <p role={messageTone === 'success' ? 'status' : 'alert'} className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}
            </div>
            <label className="block space-y-2">
              <span className="text-xs text-[var(--text-muted)]">Shared version</span>
              <input className={formFieldClassName} value="Later changes by the owner won’t change your copy." readOnly />
            </label>
          </Surface>
        )}
      </PageShell>
    </main>
  );
}

function editorTitle(action: ShareCopyAction, plannerDestination: string) {
  if (action === 'planner') return `Edit before saving to ${plannerDestination}`;
  if (action === 'library') return 'Edit before saving to My workouts';
  return 'Edit before saving as a training plan';
}

function saveLabel(action: ShareCopyAction, plannerDestination: string) {
  if (action === 'planner') return `Save to ${plannerDestination}`;
  if (action === 'library') return 'Save to My workouts';
  return 'Save as a training plan';
}

function savedMessage(action: ShareCopyAction, plannerDestination: string) {
  if (action === 'template') return 'Saved to My workouts and as a new training plan.';
  if (action === 'library') return 'Workout saved to My workouts.';
  return `Workout saved to your ${plannerDestination}.`;
}

function savedDestination(action: ShareCopyAction, userRole: AppRole | null) {
  const coach = userRole === 'COACH';
  if (action === 'template') return coach ? '/coach/templates' : '/athlete/templates';
  if (action === 'library') return '/athlete/workouts';
  return coach ? '/coach/workouts' : '/athlete/calendar';
}

function createInitialDraft(
  projection: SharedWorkoutProjection,
  userRole: AppRole | null,
  action: ShareCopyAction | null,
) {
  if (action === 'template' || action === 'library') return createSessionEditorDraftFromSharedProjection(projection);
  return createPlannerEditorDraftFromSharedProjection(projection, {
    ownershipMode: userRole === 'COACH' ? 'coach-library' : 'athlete',
  });
}
