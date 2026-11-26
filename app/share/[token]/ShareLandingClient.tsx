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

// Recipients can copy a shared workout to their Planner or save it as a private
// template. Only Planner is a continuable sign-in action (see lib/share-link.ts).
type ShareCopyAction = ShareLinkAction | 'template';

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
  const availableInitialAction: ShareCopyAction | null = initialAction && isSignedIn && userRole ? initialAction : null;
  const [action, setAction] = useState<ShareCopyAction | null>(availableInitialAction);
  const [draft, setDraft] = useState<SessionEditorDraft>(() => createInitialDraft(projection, userRole, availableInitialAction));
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const plannerDestination = userRole === 'COACH' ? 'Workouts' : 'Calendar';

  function beginAction(nextAction: ShareCopyAction) {
    if (isPending) return;
    const callbackPath = createSharePath(token, nextAction === 'template' ? undefined : nextAction);
    if (!isSignedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
      return;
    }
    if (!userRole) {
      router.push(`/setup?callbackUrl=${encodeURIComponent(callbackPath)}`);
      return;
    }

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
        setMessage(action === 'template' ? 'Saved to My workouts and as a new training plan.' : `Workout saved to your ${plannerDestination}.`);
        router.push(action === 'template'
          ? userRole === 'COACH' ? '/coach/templates' : '/athlete/templates'
          : userRole === 'COACH' ? '/coach/workouts' : '/athlete/calendar');
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
                    Pick one. You can edit the workout before anything is saved.
                  </p>
                </div>
                <div className="grid gap-3">
                  <button type="button" className={primaryButtonClassName} onClick={() => beginAction('planner')}>
                    Add to {plannerDestination}
                  </button>
                  {userRole === 'ATHLETE' ? (
                    <button type="button" className={compactSecondaryButtonClassName} onClick={() => beginAction('template')}>
                      Save as a training plan
                    </button>
                  ) : null}
                </div>
              </Surface>
            </div>
          </>
        ) : (
          <Surface className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-medium text-[var(--text)]">
                  {action === 'planner' ? `Edit before saving to ${plannerDestination}` : 'Edit before saving as a training plan'}
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
                {isPending ? 'Saving…' : action === 'planner' ? `Save to ${plannerDestination}` : 'Save as a training plan'}
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

function createInitialDraft(
  projection: SharedWorkoutProjection,
  userRole: AppRole | null,
  action: ShareCopyAction | null,
) {
  if (action === 'template') return createSessionEditorDraftFromSharedProjection(projection);
  return createPlannerEditorDraftFromSharedProjection(projection, {
    ownershipMode: userRole === 'COACH' ? 'coach-library' : 'athlete',
  });
}
