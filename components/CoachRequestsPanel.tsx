'use client';
import { useEffect, useState } from 'react';
import {
  compactDangerButtonClassName,
  compactPrimaryButtonClassName,
  Surface,
} from '@/components/ui';

type PendingRequest = {
  id: number;
  athlete: { id: number; name: string; email: string };
};

export function CoachRequestsPanel() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [actingRequestId, setActingRequestId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/coach/requests', { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Request list failed');
        return r.json();
      })
      .then((data) => setRequests(data.requests ?? []))
      .catch(() => setError('Failed to load athlete requests.'))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function handleAction(requestId: number, action: 'accept' | 'reject') {
    if (actingRequestId !== null) return;
    setMessage('');
    setError('');
    setActingRequestId(requestId);
    try {
      const res = await fetch(`/api/coach/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Request action failed');
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setMessage(action === 'accept' ? 'Athlete added to your roster.' : 'Request rejected.');
    } catch {
      setError('Failed to update athlete request. Please try again.');
    } finally {
      setActingRequestId(null);
    }
  }

  if (loading || (requests.length === 0 && !error)) return null;

  return (
    <Surface>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Athlete requests</p>
      <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Pending join requests</h2>
      {message ? <p className="mt-2 text-sm text-[var(--status-success)]">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-[var(--status-danger)]">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex flex-col items-start gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--field-surface)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">{req.athlete.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{req.athlete.email}</p>
            </div>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <button
                onClick={() => handleAction(req.id, 'accept')}
                disabled={actingRequestId !== null}
                className={compactPrimaryButtonClassName}
              >
                Accept
              </button>
              <button
                onClick={() => handleAction(req.id, 'reject')}
                disabled={actingRequestId !== null}
                className={compactDangerButtonClassName}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}
