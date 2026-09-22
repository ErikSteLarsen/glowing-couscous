'use client';

import { useEffect, useRef, useState } from 'react';

import { deriveSessionEditorMetrics, type SessionEditorDraft } from '@/lib/session-editor';
import { getSportLabel } from '@/lib/sport';
import { formatDuration } from '@/lib/format-duration';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import {
  compactSecondaryButtonClassName,
  getSegmentedChoiceClassName,
} from '@/components/ui';

type ComparisonData = {
  baseline: SessionEditorDraft | null;
  actual: SessionEditorDraft | null;
};

export function SessionComparisonDialog({
  sessionId,
  endpoint,
  label = 'Compare baseline and actual',
  perspective = 'personal',
}: {
  sessionId: number;
  endpoint: string;
  label?: string;
  perspective?: 'personal' | 'coach';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<ComparisonData | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<'baseline' | 'actual'>('actual');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch(endpoint)
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as ComparisonData & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Failed to load comparison');
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setSelectedVersion(payload.actual ? 'actual' : 'baseline');
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Failed to load comparison');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [endpoint, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const triggerButton = triggerButtonRef.current;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      triggerButton?.focus();
    };
  }, [isOpen]);

  const closeDialog = () => dialogRef.current?.close();

  const selectedDraft = data
    ? selectedVersion === 'actual'
      ? data.actual ?? data.baseline
      : data.baseline ?? data.actual
    : null;

  return (
    <>
      <button
        ref={triggerButtonRef}
        type="button"
        className={compactSecondaryButtonClassName}
        onClick={() => {
          setError('');
          setIsLoading(true);
          setData(null);
          setIsOpen(true);
        }}
      >
        {label}
      </button>
      {isOpen ? (
        <dialog
          ref={dialogRef}
          className="fixed inset-0 z-50 m-auto max-h-[calc(100dvh-2rem)] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-[5px] border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-[var(--shadow-overlay)] backdrop:bg-black/30"
          aria-labelledby={`comparison-title-${sessionId}`}
          aria-busy={isLoading}
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
          onClose={() => setIsOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            className="p-5 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Session comparison</p>
                <h2 id={`comparison-title-${sessionId}`} className="mt-2 text-xl font-semibold text-[var(--text)]">
                  Planned and actual
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className={`${compactSecondaryButtonClassName} shrink-0`}
                onClick={closeDialog}
                aria-label="Close comparison"
              >
                Close
              </button>
            </div>

            {isLoading ? <p role="status" className="mt-6 text-sm text-[var(--text-secondary)]">Loading comparison…</p> : null}
            {error ? <p role="alert" className="mt-6 text-sm text-[var(--status-danger)]">{error}</p> : null}
            {!isLoading && !error && !selectedDraft ? (
              <p className="mt-6 text-sm text-[var(--text-secondary)]">No planned or actual snapshot is available for this session.</p>
            ) : null}

            {!isLoading && !error && selectedDraft ? (
              <div className="mt-6 space-y-5">
                {data?.baseline && data.actual ? (
                  <div className="flex gap-2 rounded-[3px] bg-[var(--field-surface)] p-1" role="group" aria-label="Comparison version">
                    <button
                      type="button"
                      aria-pressed={selectedVersion === 'baseline'}
                      className={getSegmentedChoiceClassName(selectedVersion === 'baseline', 'compact')}
                      onClick={() => setSelectedVersion('baseline')}
                    >
                      {perspective === 'coach' ? 'Coach plan' : 'Planned'}
                    </button>
                    <button
                      type="button"
                      aria-pressed={selectedVersion === 'actual'}
                      className={getSegmentedChoiceClassName(selectedVersion === 'actual', 'compact')}
                      onClick={() => setSelectedVersion('actual')}
                    >
                      {perspective === 'coach' ? 'Athlete actual' : 'Actual'}
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {data?.actual ? 'Only the actual snapshot is available.' : 'Only the planned snapshot is available.'}
                  </p>
                )}
                <SnapshotView draft={selectedDraft} />
              </div>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}

function SnapshotView({ draft }: { draft: SessionEditorDraft }) {
  const metrics = deriveSessionEditorMetrics(draft);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-[var(--text)]">{draft.title}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {getSportLabel(draft.sport)}{draft.scheduledDate ? ` · ${draft.scheduledDate}` : ''}
        </p>
        {draft.summary ? <p className="mt-3 text-sm leading-[1.5] text-[var(--text-secondary)]">{draft.summary}</p> : null}
      </div>
      <div className="flex flex-wrap gap-4 text-[13px] text-[var(--text-secondary)]">
        <MetricText>{formatDuration(metrics.durationSec)}</MetricText>
        <MetricText>{metrics.tss} TSS</MetricText>
        {draft.rpe !== null ? <MetricText>RPE {draft.rpe}</MetricText> : null}
      </div>
      <SessionBlockBar segments={metrics.segments} />
      {draft.coachNotes || draft.athleteNotes ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {draft.coachNotes ? <p className="rounded-[3px] bg-[var(--brand-tint)] px-3 py-2 text-sm text-[var(--text)]"><strong>Coach note:</strong> {draft.coachNotes}</p> : null}
          {draft.athleteNotes ? <p className="rounded-[3px] bg-[var(--brand-tint)] px-3 py-2 text-sm text-[var(--text)]"><strong>Athlete note:</strong> {draft.athleteNotes}</p> : null}
        </div>
      ) : null}
      <div className="space-y-2">
        {draft.blocks.map((block, index) => (
          <div key={block.clientId} className={`rounded-[3px] border border-[var(--border)] bg-[var(--field-surface)] p-3 ${block.skipped ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--text)]">
              <span className="font-semibold">{index + 1}. {block.kind}{block.skipped ? ' · skipped' : ''}</span>
              <span>{formatDuration(block.durationSec)}</span>
            </div>
            {block.note ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{block.note}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
