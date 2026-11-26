'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';

import { iconButtonClassName, sectionHeadingClassName, sheetDialogClassName } from '@/components/ui';

/**
 * The Calendar's add and move dialogs: a bottom sheet on phones and a centered
 * panel wider up. `size="compact"` fits its content (Move workout); the default
 * keeps one tall height so browsing does not jump. A fixed header (title, step trail, close), a body that scrolls on
 * its own, and a fixed footer for the step's main action. Closing while a
 * request is in flight is blocked so a placement is never left half-confirmed.
 */
export function AddDialogFrame({
  title,
  description,
  steps,
  busy,
  onClose,
  footer,
  children,
  size = 'tall',
}: {
  title: string;
  description?: ReactNode;
  /** Step trail, e.g. Plan › Dates › Review; the current step is marked. */
  steps?: { label: string; state: 'done' | 'current' | 'next' }[];
  busy: boolean;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
  size?: 'tall' | 'compact';
}) {
  // The chosen row or step button leaves the page on a step change; put focus on
  // the new step's title instead of letting it fall back to the document.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const current = steps?.find((step) => step.state === 'current')?.label;
  const firstStep = useRef(current);
  useEffect(() => {
    if (current !== firstStep.current) titleRef.current?.focus();
    firstStep.current = undefined;
  }, [current]);

  return (
    <Dialog open onOpenChange={(next, details) => {
      if (next) return;
      if (busy) details.cancel();
      else onClose();
    }}>
      <DialogBackdrop className="fixed inset-0 bg-black/60" />
      <DialogContent
        initialFocus="content"
        className={`${sheetDialogClassName} z-50 grid-rows-[auto_minmax(0,1fr)_auto] text-left md:w-[calc(100%-4rem)] ${size === 'tall'
          ? 'max-w-2xl max-md:h-[calc(100dvh-1rem)] md:h-[min(46rem,calc(100dvh-4rem))]'
          : 'max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 pt-5 pb-4">
          <div className="min-w-0 space-y-1">
            <DialogTitle ref={titleRef} tabIndex={-1} className={`${sectionHeadingClassName} outline-none`}>
              {title}{current ? <span className="sr-only">, step: {current}</span> : null}
            </DialogTitle>
            {description ? <DialogDescription className="text-[13px] text-[var(--text-secondary)]">{description}</DialogDescription> : null}
            {steps ? (
              <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5 text-[13px]">
                {steps.map((step, index) => (
                  <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined} className="flex items-center gap-2">
                    {index > 0 ? <span aria-hidden="true" className="h-px w-4 bg-[var(--border-strong)]" /> : null}
                    <span className={`inline-flex items-center gap-1.5 ${step.state === 'current' ? 'font-medium text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                      <span aria-hidden="true" className={`data inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                        step.state === 'current' ? 'bg-[var(--brand)] text-[var(--signal-ink)]' : step.state === 'done' ? 'bg-[var(--raised)] text-[var(--text)]' : 'border border-[var(--border-strong)]'
                      }`}>
                        {step.state === 'done' ? <Check size={12} strokeWidth={2.4} /> : index + 1}
                      </span>
                      {step.label}
                      {step.state === 'done' ? <span className="sr-only"> (done)</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
          <DialogClose type="button" className={iconButtonClassName} aria-label="Close" disabled={busy}>
            <X aria-hidden="true" size={18} />
          </DialogClose>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * POSTs one placement. Retries of the same body reuse one request key, so the
 * server never places it twice; a changed body gets a new key.
 */
export function usePlacementRequest() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const request = useRef<{ signature: string; requestKey: string } | null>(null);

  function send(endpoint: string, body: Record<string, unknown>, onDone: (sessionIds: number[]) => void) {
    if (inFlight.current) return;
    const signature = JSON.stringify([endpoint, body]);
    if (request.current?.signature !== signature) request.current = { signature, requestKey: crypto.randomUUID() };
    const requestKey = request.current.requestKey;
    inFlight.current = true;
    setError('');
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, requestKey }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string; sessionIds?: number[] };
        if (!response.ok) {
          setError(payload.error ?? 'Could not add this to your Calendar.');
          return;
        }
        request.current = null;
        onDone(payload.sessionIds ?? []);
      } catch {
        setError('Could not confirm this. Check your connection and try again.');
      } finally {
        inFlight.current = false;
      }
    });
  }

  return { send, isPending, error, setError };
}
