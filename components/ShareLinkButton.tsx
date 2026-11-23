'use client';

import { useState, useTransition } from 'react';

import {
  compactSecondaryButtonClassName,
  dangerTextClassName,
  formFieldClassName,
  secondaryButtonClassName,
  successTextClassName,
} from '@/components/ui';

type ShareLinkState = ReturnType<typeof useShareLink>;

/** Creates a public share link for a source and copies it, keeping the URL and feedback for display. */
export function useShareLink(sourceKind: 'session', sourceId: number) {
  const [shareUrl, setShareUrl] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, startTransition] = useTransition();

  function createLink() {
    setMessage('');
    startTransition(async () => {
      try {
        const response = await fetch('/api/share-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceKind, sourceId }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string; url?: string };
        if (!response.ok || !payload.url) {
          setMessageTone('danger');
          setMessage(payload.error ?? 'Could not create a share link. Try again.');
          return;
        }

        setShareUrl(payload.url);
        await copyLink(payload.url);
      } catch {
        setMessageTone('danger');
        setMessage('Could not create a share link. Try again.');
      }
    });
  }

  async function copyLink(url = shareUrl) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
      setMessageTone('success');
      setMessage('Link copied.');
    } catch {
      setMessageTone('success');
      setMessage('Link created. Copy it from the box.');
    }
  }

  return { shareUrl, message, messageTone, isPending, createLink, copyLink };
}

/** The created link, its copy action and feedback. Renders nothing until a link or message exists. */
export function ShareLinkResult({ share, showAudience = false }: { share: ShareLinkState; showAudience?: boolean }) {
  return (
    <>
      {share.shareUrl ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className={`${formFieldClassName} min-w-0 text-xs`} value={share.shareUrl} readOnly aria-label="Share link" />
            <button type="button" className={secondaryButtonClassName} onClick={() => void share.copyLink()}>
              Copy link
            </button>
          </div>
          {showAudience ? <p className="text-[11px] leading-[1.4] text-[var(--text-muted)]">Anyone with this link can see this workout.</p> : null}
        </div>
      ) : null}
      {share.isPending ? <p role="status" className="text-xs text-[var(--text-secondary)]">Creating share link…</p> : null}
      {share.message ? <p role={share.messageTone === 'success' ? 'status' : 'alert'} aria-live="polite" className={share.messageTone === 'success' ? successTextClassName : dangerTextClassName}>{share.message}</p> : null}
    </>
  );
}

export function ShareLinkButton({
  sourceKind,
  sourceId,
  ariaLabel,
}: {
  sourceKind: 'session';
  sourceId: number;
  ariaLabel?: string;
}) {
  const share = useShareLink(sourceKind, sourceId);

  return (
    <div className="space-y-2">
      <button type="button" aria-label={ariaLabel} className={compactSecondaryButtonClassName} onClick={share.createLink} disabled={share.isPending}>
        {share.isPending ? 'Creating share link…' : 'Create share link'}
      </button>
      <p className="text-[11px] leading-[1.4] text-[var(--text-muted)]">Anyone with this link can see this workout.</p>
      <ShareLinkResult share={{ ...share, isPending: false }} />
    </div>
  );
}
