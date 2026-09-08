'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { SessionComposer } from '@/components/SessionComposer';
import {
  Badge,
  compactSecondaryButtonClassName,
  dangerTextClassName,
  formFieldClassName,
  primaryButtonClassName,
  Surface,
  successTextClassName,
  PageShell,
  TopBar,
} from '@/components/ui';
import { formatDuration } from '@/lib/format-duration';
import {
  createPlannerEditorDraftFromSharedProjection,
  createTemplateEditorDraftFromSharedProjection,
} from '@/lib/session-editor-adapters';
import {
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
  type SessionEditorDraft,
} from '@/lib/session-editor';
import {
  createSharePath,
  type SharedWorkoutProjection,
  type ShareLinkAction,
} from '@/lib/share-link';
import type { AppRole } from '@/lib/app-navigation';
import { getSportLabel } from '@/lib/sport';

export function ShareLandingClient({
  token,
  projection,
  isSignedIn,
  userRole,
  initialAction,
}: {
  token: string;
  projection: SharedWorkoutProjection;
  isSignedIn: boolean;
  userRole: AppRole | null;
  initialAction: ShareLinkAction | null;
}) {
  const router = useRouter();
  const availableInitialAction = initialAction && isSignedIn && userRole ? initialAction : null;
  const [action, setAction] = useState<ShareLinkAction | null>(availableInitialAction);
  const [draft, setDraft] = useState<SessionEditorDraft>(() => createInitialDraft(projection, userRole, availableInitialAction));
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, startTransition] = useTransition();

  function beginAction(nextAction: ShareLinkAction) {
    const callbackPath = createSharePath(token, nextAction);
    if (!isSignedIn) {
      window.location.assign(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
      return;
    }
    if (!userRole) {
      window.location.assign(`/setup?callbackUrl=${encodeURIComponent(callbackPath)}`);
      return;
    }

    setAction(nextAction);
    setDraft(createInitialDraft(projection, userRole, nextAction));
    setMessage('');
  }

  function save() {
    if (!action) return;
    const validationError = validateSessionEditorDraft(draft);
    if (validationError) {
      setMessageTone('danger');
      setMessage(validationError);
      return;
    }

    startTransition(async () => {
      const response = await fetch('/api/share-links/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, draft: serializeSessionEditorDraft(draft) }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to save shared workout.');
        return;
      }

      setMessageTone('success');
      setMessage(action === 'template' ? 'Private template saved.' : 'Session saved to your planner.');
      router.push(action === 'template'
        ? userRole === 'COACH' ? '/coach/templates' : '/athlete/templates'
        : userRole === 'COACH' ? '/coach/planner' : '/athlete/planner');
    });
  }

  return (
    <PageShell size="wide" className="max-w-[1180px]">
      <TopBar
        title={projection.title || 'Shared workout'}
        description="A read-only snapshot. Anyone with this URL can view the workout definition."
      />

      {!action ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Surface className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="brand">{getSportLabel(projection.sport)}</Badge>
                <Badge>{formatDuration(projection.metrics.durationSec)}</Badge>
                <Badge>{projection.metrics.tss} TSS</Badge>
              </div>
              <p className="text-[15px] leading-[1.6] text-[var(--text-secondary)]">
                {projection.summary || 'Workout definition shared from Tempo.'}
              </p>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Workout blocks</p>
                {projection.blocks.map((block, index) => (
                  <div key={`${block.kind}-${index}`} className="rounded-[12px] border border-[var(--border)] bg-[var(--field-surface)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold capitalize text-[var(--text)]">
                          {block.kind}{block.skipped ? ' · skipped' : ''}
                        </p>
                        {block.note ? <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{block.note}</p> : null}
                      </div>
                      <span className="text-[13px] font-medium text-[var(--text-secondary)]">
                        {formatDuration(block.durationSec)}{block.reps ? ` · ${block.reps} reps` : ''}
                      </span>
                    </div>
                    {block.target ? (
                      <p className="mt-3 text-[12px] text-[var(--text-secondary)]">
                        Target: {block.target.type} {block.target.low}-{block.target.high}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Surface>

            <Surface className="flex flex-col justify-between gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Choose what to do</p>
                <p className="mt-2 text-sm leading-[1.55] text-[var(--text-secondary)]">
                  Nothing is saved or scheduled until you edit and confirm one of these actions.
                </p>
              </div>
              <div className="grid gap-3">
                <button type="button" className={primaryButtonClassName} onClick={() => beginAction('planner')}>
                  Use in Planner
                </button>
                <button type="button" className={compactSecondaryButtonClassName} onClick={() => beginAction('template')}>
                  Save as Template
                </button>
              </div>
            </Surface>
          </div>
        </>
      ) : (
        <Surface className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {action === 'planner' ? 'Planner intake' : 'Template intake'}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">
                {action === 'planner' ? 'Edit before saving to Planner' : 'Edit before saving as Template'}
              </h2>
            </div>
            <button type="button" className={compactSecondaryButtonClassName} onClick={() => setAction(null)} disabled={isPending}>
              Back to preview
            </button>
          </div>
          <SessionComposer
            draft={draft}
            onChange={setDraft}
            showSchedule={action === 'planner'}
            summaryPlaceholder="Workout summary"
            durationUnit="minutes"
          />
          {action === 'planner' ? (
            <p className="text-sm text-[var(--text-secondary)]">
              {userRole === 'COACH' ? 'This will save as a private standalone coach-library session.' : 'This will save as a private athlete Planner session.'}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={primaryButtonClassName} onClick={save} disabled={isPending}>
              {isPending ? 'Saving…' : action === 'planner' ? 'Save to Planner' : 'Save as Template'}
            </button>
            {message ? <p className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}
          </div>
          <label className="block space-y-2">
            <span className="text-xs text-[var(--text-muted)]">Shared snapshot</span>
            <input className={formFieldClassName} value="Source edits cannot change this snapshot." readOnly />
          </label>
        </Surface>
      )}
    </PageShell>
  );
}

function createInitialDraft(
  projection: SharedWorkoutProjection,
  userRole: AppRole | null,
  action: ShareLinkAction | null,
) {
  if (action === 'template') return createTemplateEditorDraftFromSharedProjection(projection);
  return createPlannerEditorDraftFromSharedProjection(projection, {
    ownershipMode: userRole === 'COACH' ? 'coach-library' : 'athlete',
  });
}
