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

  useEffect(() => {
    fetch('/api/coach/requests')
      .then((r) => r.json())
      .then((data) => {
        setRequests(data.requests ?? []);
        setLoading(false);
      });
  }, []);

  async function handleAction(requestId: number, action: 'accept' | 'reject') {
    await fetch(`/api/coach/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
  }

  if (loading || requests.length === 0) return null;

  return (
    <Surface>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Athlete requests</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Pending join requests</h2>
      <div className="mt-4 space-y-3">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-white">{req.athlete.name}</p>
              <p className="text-xs text-slate-400">{req.athlete.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(req.id, 'accept')}
                className="cursor-pointer rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Accept
              </button>
              <button
                onClick={() => handleAction(req.id, 'reject')}
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-white/10"
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
