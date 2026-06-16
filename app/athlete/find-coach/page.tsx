'use client';
import { useEffect, useMemo, useState } from 'react';
import { ActionLink, PageShell, Surface, TopBar } from '@/components/ui';
import { SignOutButton } from '@/components/SignOutButton';

type CoachResult = { id: number; name: string; email: string };
type CoachRequestRecord = {
  id: number;
  status: string;
  updatedAt: string;
  coach: CoachResult;
};

export default function FindCoachPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoachResult[]>([]);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestState, setRequestState] = useState<{
    latestRequest: CoachRequestRecord | null;
    requests: CoachRequestRecord[];
  }>({ latestRequest: null, requests: [] });
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const requestsByCoachId = useMemo(
    () =>
      Object.fromEntries(requestState.requests.map((request) => [request.coach.id, request.status])),
    [requestState.requests],
  );

  useEffect(() => {
    void loadRequestState();
  }, []);

  async function loadRequestState() {
    const res = await fetch('/api/athlete/coach-requests');
    if (!res.ok) {
      setErrorMessage('Failed to load your request state.');
      return;
    }

    const data = (await res.json()) as { requests?: CoachRequestRecord[] };
    const requests = data.requests ?? [];
    setRequestState({
      latestRequest: requests[0] ?? null,
      requests,
    });
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setErrorMessage('');
    const res = await fetch(`/api/coaches?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      setResults([]);
      setLoading(false);
      setErrorMessage('Search failed. Please try again.');
      return;
    }
    const data = await res.json();
    setResults(data.coaches ?? []);
    setLastSubmittedQuery(query);
    setLoading(false);
  }

  async function handleRequest(coachId: number) {
    setErrorMessage('');
    setFeedbackMessage('');
    const res = await fetch('/api/athlete/coach-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId }),
    });
    const payload = (await res.json().catch(() => ({ error: 'Failed to send request.' }))) as {
      error?: string;
    };

    if (res.ok) {
      await loadRequestState();
      setFeedbackMessage('Request pending. Back to profile while you wait for coach approval.');
      return;
    }

    if (res.status === 409) {
      await loadRequestState();
      setFeedbackMessage('Request pending. Back to profile while you wait for coach approval.');
      return;
    }

    setErrorMessage(payload.error ?? 'Failed to send request.');
  }

  return (
    <PageShell>
      <TopBar
        eyebrow="Find a coach"
        title="Search coaches"
        description="Search by name or email, then send a join request."
        actions={<SignOutButton />}
      />
      <Surface>
        {requestState.latestRequest?.status === 'PENDING' ? (
          <div className="mb-4 rounded-2xl border border-[rgba(90,124,255,0.28)] bg-[rgba(90,124,255,0.12)] px-4 py-3 text-sm text-slate-100">
            Request pending with {requestState.latestRequest.coach.name}.{' '}
            <span className="text-slate-200">Back to profile while you wait for approval.</span>
          </div>
        ) : null}

        {feedbackMessage ? <p className="mb-4 text-sm text-emerald-300">{feedbackMessage}</p> : null}
        {errorMessage ? <p className="mb-4 text-sm text-amber-300">{errorMessage}</p> : null}

        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {requestState.latestRequest?.status === 'PENDING' ? (
          <div className="mt-4">
            <ActionLink href="/athlete/profile" tone="secondary">
              Back to profile
            </ActionLink>
          </div>
        ) : null}

        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            {results.map((coach) => (
              <div key={coach.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                {requestsByCoachId[coach.id] === 'REJECTED' ? (
                  <p className="mb-2 text-xs text-amber-300">Your last request to this coach was declined. Send request again if you want to retry.</p>
                ) : null}
                <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{coach.name}</p>
                  <p className="text-xs text-slate-400">{coach.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequest(coach.id)}
                  disabled={requestsByCoachId[coach.id] === 'PENDING'}
                  className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {requestsByCoachId[coach.id] === 'PENDING'
                    ? 'Request pending'
                    : requestsByCoachId[coach.id] === 'REJECTED'
                      ? 'Send request again'
                      : 'Request to join'}
                </button>
              </div>
              </div>
            ))}
          </div>
        )}

        {lastSubmittedQuery && results.length === 0 && !loading && (
          <p className="mt-4 text-sm text-slate-400">No coaches found for &ldquo;{lastSubmittedQuery}&rdquo;.</p>
        )}
      </Surface>
    </PageShell>
  );
}
