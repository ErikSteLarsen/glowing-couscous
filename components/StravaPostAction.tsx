'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Download, ExternalLink, X } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';
import {
  buttonFocusClassName,
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  formTextareaClassName,
  ghostButtonClassName,
  iconButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  sectionHeadingClassName,
  sheetDialogClassName,
} from '@/components/ui';
import { STRAVA_POST_DESCRIPTION_MAX, STRAVA_POST_TITLE_MAX } from '@/lib/strava-post';
import type { StravaPostView } from '@/lib/strava-post-service';

type PostState =
  | { kind: 'editing' }
  | { kind: 'posting' }
  | { kind: 'posted'; url: string; duplicate: boolean }
  | { kind: 'processing'; message: string }
  | { kind: 'failed'; message: string };

const STRAVA_UPLOAD_URL = 'https://www.strava.com/upload/select';

function apiPath(activityId: number, suffix = '') {
  return `/api/athlete/activities/${activityId}${suffix}`;
}

/** "Posted to Strava" and a "View on Strava" link, shown instead of the post button once an activity is on Strava. */
export function StravaPostedNote({ url, className = '' }: { url: string; className?: string }) {
  return (
    <p className={`inline-flex min-h-10 flex-wrap items-center gap-x-1.5 text-sm text-[var(--text-secondary)] ${className}`}>
      <Check aria-hidden="true" size={16} strokeWidth={1.8} className="text-[var(--status-success)]" />
      Posted to Strava
      <a href={url} target="_blank" rel="noreferrer" className={`${ghostButtonClassName('compact')} -mr-1`}>
        View on Strava<ExternalLink aria-hidden="true" size={14} strokeWidth={1.8} />
      </a>
    </p>
  );
}

/**
 * Post a saved activity to Strava: a preview of the title, description and image, editable
 * before posting. Connecting, reconnecting for upload permission and the .tcx fallback all
 * live in the same sheet. Pass `initial` when the page already loaded the post view;
 * otherwise it loads when the sheet opens.
 */
export function StravaPostAction({
  activityId,
  initial = null,
  returnPath,
  autoOpen = false,
  tone = 'secondary',
}: {
  activityId: number;
  initial?: StravaPostView | null;
  /** Where the Strava connect flow brings the athlete back to. */
  returnPath: string;
  autoOpen?: boolean;
  tone?: 'primary' | 'secondary';
}) {
  const router = useRouter();
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<StravaPostView | null>(initial);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(autoOpen && initial?.availability === 'ready');
  const [name, setName] = useState(initial?.draft.name ?? '');
  const [description, setDescription] = useState(initial?.draft.description ?? '');
  const [state, setState] = useState<PostState>({ kind: 'editing' });
  const [imageReady, setImageReady] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const busy = state.kind === 'posting';

  // Opening from the ride summary loads the preview the first time.
  useEffect(() => {
    if (!open || view) return;
    let cancelled = false;
    fetch(apiPath(activityId, '/strava'), { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !payload) {
          setLoadError(typeof payload?.error === 'string' ? payload.error : 'Could not load the Strava preview. Try again.');
          return;
        }
        setView(payload as StravaPostView);
        setName((payload as StravaPostView).draft.name);
        setDescription((payload as StravaPostView).draft.description);
      })
      .catch(() => { if (!cancelled) setLoadError('Could not reach Wattonaut. Check your connection and try again.'); });
    return () => { cancelled = true; };
  }, [open, view, activityId]);

  if (view?.posted) return <StravaPostedNote url={view.posted.url} />;
  if (view && view.availability !== 'ready') return null;
  if (state.kind === 'posted' && !open) return <StravaPostedNote url={state.url} />;

  async function post() {
    setState({ kind: 'posting' });
    let response: Response | null = null;
    let payload: { url?: string; duplicate?: boolean; error?: string; reason?: string | null } | null = null;
    try {
      response = await fetch(apiPath(activityId, '/strava'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      payload = await response.json().catch(() => null);
    } catch {
      setState({ kind: 'failed', message: 'Could not reach Wattonaut. Check your connection and try again.' });
      return;
    }
    if (response.ok && payload?.url) {
      // The page refreshes when the sheet closes, so the confirmation stays put until then.
      setState({ kind: 'posted', url: payload.url, duplicate: payload.duplicate === true });
      return;
    }
    if (payload?.reason === 'needs-scope' || payload?.reason === 'not-connected') {
      setView((current) => current ? { ...current, access: payload?.reason === 'needs-scope' ? { state: 'needs-scope' } : { state: 'not-connected', canConnect: true } } : current);
      setState({ kind: 'editing' });
      return;
    }
    const message = typeof payload?.error === 'string' ? payload.error : 'Could not post to Strava. Try again.';
    setState(response.status === 202 ? { kind: 'processing', message } : { kind: 'failed', message });
  }

  const connectHref = `/api/strava/connect?returnTo=${encodeURIComponent(returnPath)}`;
  const tcxHref = apiPath(activityId, '/tcx');
  const imageHref = apiPath(activityId, '/strava/image');
  const access = view?.access;

  const manualFallback = (
    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
      Or upload it yourself: <a href={tcxHref} download className="text-[var(--brand)] underline underline-offset-2">download the .tcx file</a> and add it at{' '}
      <a href={STRAVA_UPLOAD_URL} target="_blank" rel="noreferrer" className="text-[var(--brand)] underline underline-offset-2">strava.com/upload</a>.
    </p>
  );

  let body: ReactNode;
  let actions: ReactNode;
  if (!view) {
    body = loadError
      ? <p role="alert" className={dangerTextClassName}>{loadError}</p>
      : <div className="space-y-3" aria-hidden="true"><div className="skeleton aspect-[16/9] w-full rounded-xl" /><div className="skeleton h-10 rounded-lg" /><div className="skeleton h-24 rounded-lg" /></div>;
    actions = <DialogClose type="button" className={secondaryButtonClassName}>Close</DialogClose>;
  } else if (state.kind === 'posted') {
    body = (
      <div className="space-y-4">
        <p role="status" className="flex items-start gap-2 text-[15px] text-[var(--text)]">
          <Check aria-hidden="true" size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[var(--status-success)]" />
          {state.duplicate ? 'This activity was already on Strava, so Wattonaut linked to it instead of posting it again.' : 'Posted to Strava.'}
        </p>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          The picture wasn’t posted: Strava only lets its partner apps attach photos. Download it and add it to the activity in the Strava app.
        </p>
      </div>
    );
    actions = (
      <>
        <a href={`${imageHref}?download=1`} download className={secondaryButtonClassName}>
          <Download aria-hidden="true" size={16} strokeWidth={1.7} />Download image
        </a>
        <a href={state.url} target="_blank" rel="noreferrer" className={primaryButtonClassName}>
          View on Strava<ExternalLink aria-hidden="true" size={15} strokeWidth={1.8} />
        </a>
      </>
    );
  } else if (access?.state === 'not-connected') {
    body = (
      <div className="space-y-3">
        <p className="text-[15px] text-[var(--text)]">Connect Strava to post this activity.</p>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {access.canConnect
            ? 'You’ll sign in on Strava, allow Wattonaut to read and upload activities, and come straight back here.'
            : 'Strava isn’t set up on this Wattonaut server yet.'}
        </p>
        {manualFallback}
      </div>
    );
    actions = (
      <>
        <DialogClose type="button" className={secondaryButtonClassName}>Not now</DialogClose>
        {access.canConnect ? <a href={connectHref} className={primaryButtonClassName}>Connect Strava</a> : null}
      </>
    );
  } else if (access?.state === 'needs-scope') {
    body = (
      <div className="space-y-3">
        <p className="text-[15px] text-[var(--text)]">Reconnect Strava to allow posting.</p>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Wattonaut can read your Strava activities but isn’t allowed to upload them yet. Reconnect,
          keep the permission to upload activities ticked on Strava, and you’ll come back here to post.
        </p>
        {manualFallback}
      </div>
    );
    actions = (
      <>
        <DialogClose type="button" className={secondaryButtonClassName}>Not now</DialogClose>
        <a href={`${connectHref}&reconnect=1`} className={primaryButtonClassName}>Reconnect Strava</a>
      </>
    );
  } else {
    body = (
      <div className="space-y-5">
        <div className="space-y-4">
          <div>
            <label htmlFor={`${id}-name`} className={formLabelClassName}>Title</label>
            <input
              id={`${id}-name`}
              className={formFieldClassName}
              value={name}
              maxLength={STRAVA_POST_TITLE_MAX}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`${id}-description`} className={formLabelClassName}>Description</label>
              <span className="data text-[11px] text-[var(--text-muted)]">{description.length}/{STRAVA_POST_DESCRIPTION_MAX}</span>
            </div>
            <textarea
              id={`${id}-description`}
              className={`${formTextareaClassName} min-h-[12rem] text-[14px] leading-[1.5]`}
              rows={Math.min(14, Math.max(8, description.split('\n').length + 1))}
              value={description}
              maxLength={STRAVA_POST_DESCRIPTION_MAX}
              spellCheck={false}
              disabled={busy}
              onChange={(event) => setDescription(event.target.value)}
            />
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
              Posted exactly as written. Strava adds its own map and stats below it. Emoji can look slightly different on each phone.
            </p>
          </div>
        </div>

        <details className="group rounded-xl border border-[var(--border)]" onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) setShowImage(true); }}>
          <summary className={`flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-[var(--text)] ${buttonFocusClassName}`}>
            <span>Picture <span className="font-normal text-[var(--text-muted)]">– not posted to Strava</span></span>
            <ChevronDown aria-hidden="true" size={16} className="text-[var(--text-muted)] transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 px-4 pb-4">
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Strava only lets its partner apps, like Zwift and Garmin, attach photos, so Wattonaut can’t post this picture.
              Download it and add it to the activity in the Strava app.
            </p>
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
              {imageReady ? null : <div className="skeleton absolute inset-0" aria-hidden="true" />}
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- a generated PNG served by Wattonaut, not a static asset
                <img
                  src={imageHref}
                  alt={`Chart of ${name || 'this activity'}: recorded power and heart rate over the planned blocks.`}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${imageReady ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setImageReady(true)}
                />
              ) : null}
            </div>
            <a href={`${imageHref}?download=1`} download className={secondaryButtonClassName}>
              <Download aria-hidden="true" size={16} strokeWidth={1.7} />Download image
            </a>
          </div>
        </details>

        <div aria-live="polite" className="empty:hidden">
          {busy ? <p role="status" className="text-sm text-[var(--text-secondary)]">Uploading to Strava. This takes a few seconds.</p> : null}
          {state.kind === 'processing' ? <p role="status" className="text-sm text-[var(--text-secondary)]">{state.message}</p> : null}
          {state.kind === 'failed' ? (
            <div className="space-y-2">
              <p role="alert" className={dangerTextClassName}>{state.message}</p>
              {manualFallback}
            </div>
          ) : null}
        </div>
        {view.processing && state.kind === 'editing' ? (
          <p className="text-sm text-[var(--text-secondary)]">Strava was still processing an earlier upload of this activity. Posting checks on it first.</p>
        ) : null}
      </div>
    );
    actions = (
      <>
        <DialogClose type="button" className={secondaryButtonClassName} disabled={busy}>Not now</DialogClose>
        <button type="button" className={primaryButtonClassName} disabled={busy || !name.trim()} onClick={() => void post()}>
          {busy ? 'Posting…' : state.kind === 'processing' ? 'Check again' : 'Post to Strava'}
        </button>
      </>
    );
  }

  return (
    <>
      <button ref={triggerRef} type="button" className={tone === 'primary' ? primaryButtonClassName : secondaryButtonClassName} onClick={() => setOpen(true)}>
        Post to Strava
      </button>
      <Dialog open={open} onOpenChange={(next, details) => {
        if (!next && busy) details.cancel();
        else setOpen(next);
        if (!next && state.kind === 'posted') router.refresh();
      }}>
        <DialogBackdrop className="fixed inset-0 bg-black/60" />
        <DialogContent
          initialFocus="content"
          finalFocus={() => triggerRef.current}
          className={`${sheetDialogClassName} max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] md:max-h-[calc(100dvh-3rem)] md:w-[calc(100%-4rem)]`}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
            <div className="min-w-0">
              <DialogTitle className={sectionHeadingClassName}>Post to Strava</DialogTitle>
              <DialogDescription className="mt-1 text-[13px] text-[var(--text-secondary)]">
                {state.kind === 'posted' ? 'Your activity is on Strava.'
                  : access?.state === 'not-connected' ? 'Strava isn’t connected yet.'
                    : access?.state === 'needs-scope' ? 'Wattonaut needs one more permission.'
                      : 'This title and description go to Strava. Edit them before you post.'}
              </DialogDescription>
            </div>
            <DialogClose type="button" className={iconButtonClassName} aria-label="Close" disabled={busy}>
              <X aria-hidden="true" size={17} />
            </DialogClose>
          </div>
          <div className="overflow-y-auto overscroll-contain px-5 pt-1 pb-5">{body}</div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] max-md:[&>*]:min-h-11 max-md:[&>*]:flex-1">
            {actions}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
