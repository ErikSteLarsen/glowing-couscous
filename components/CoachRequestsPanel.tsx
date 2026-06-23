'use client';
import { useEffect, useState } from 'react';
import { Surface } from '@/components/ui';

type PendingRequest = {
  id: number;
  athlete: { id: number; name: string; email: string };
};

export function CoachRequestsPanel() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/coach/requests', { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setRequests(data.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function handleAction(requestId: number, action: 'accept' | 'reject') {
    setMessage('');
    const res = await fetch(`/api/coach/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setMessage(action === 'accept' ? 'Athlete added to your roster.' : 'Request rejected.');
    }
  }

  if (loading || requests.length === 0) return null;

  return (
    <Surface>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Athlete requests</p>
      <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Pending join requests</h2>
      {message ? <p className="mt-2 text-sm text-[#57654E]">{message}</p> : null}
      <div className="mt-4 space-y-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex items-center justify-between rounded-[12px] border border-[var(--border)] bg-[#FBFAF7] px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--text)]">{req.athlete.name}</p>
              <p className="text-xs text-[var(--text-secondary)]">{req.athlete.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(req.id, 'accept')}
                className="min-h-11 rounded-[10px] bg-[var(--text)] px-4 text-sm font-semibold text-white"
              >
                Accept
              </button>
              <button
                onClick={() => handleAction(req.id, 'reject')}
                className="min-h-11 rounded-[10px] border border-[#FAD8BE] bg-[#FEEDE0] px-4 text-sm font-semibold text-[#B45516]"
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
