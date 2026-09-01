'use client';

import { useState, useTransition } from 'react';

import {
  compactSecondaryButtonClassName,
  dangerTextClassName,
  formFieldClassName,
  successTextClassName,
} from '@/components/ui';

export function ShareLinkButton({
  sourceKind,
  sourceId,
}: {
  sourceKind: 'session' | 'template';
  sourceId: number;
}) {
  const [shareUrl, setShareUrl] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, startTransition] = useTransition();

  function createLink() {
    setMessage('');
    startTransition(async () => {
      const response = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKind, sourceId }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; url?: string };
      if (!response.ok || !payload.url) {
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to create share link.');
        return;
      }

      setShareUrl(payload.url);
      await copyLink(payload.url);
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
      setMessage('Link created. Copy it from the field.');
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" className={compactSecondaryButtonClassName} onClick={createLink} disabled={isPending}>
        {isPending ? 'Creating link…' : 'Share'}
      </button>
      <p className="text-[11px] leading-[1.4] text-[var(--text-muted)]">Anyone with the URL can view this workout.</p>
      {shareUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={`${formFieldClassName} min-w-0 text-xs`} value={shareUrl} readOnly aria-label="Share link" />
          <button type="button" className={compactSecondaryButtonClassName} onClick={() => void copyLink()}>
            Copy link
          </button>
        </div>
      ) : null}
      {message ? <p className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}
    </div>
  );
}
