'use client';
import { useMemo, useState } from 'react';
import {
  ActionLink,
  compactPrimaryButtonClassName,
  dangerTextClassName,
  formFieldClassName,
  primaryButtonClassName,
  successTextClassName,
  PageShell,
  Surface,
  TopBar,
} from '@/components/ui';

type CoachResult = { id: number; name: string; email: string };
type CoachRequestRecord = {
  id: number;
  status: string;
  updatedAt: Date | string;
  coach: CoachResult;
};

type InitialState = {
  profile: { id: number } | null;
  requests: CoachRequestRecord[];
  latestRequest: CoachRequestRecord | null;
};

export function FindCoachClient({ initialState }: { initialState: InitialState }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoachResult[]>([]);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestState, setRequestState] = useState({
    latestRequest: initialState.latestRequest,
    requests: initialState.requests,
  });
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [requestingCoachId, setRequestingCoachId] = useState<number | null>(null);

  const requestsByCoachId = useMemo(
    () => Object.fromEntries(requestState.requests.map((r) => [r.coach.id, r.status])),
    [requestState.requests],
  );
  const hasPendingRequest = requestState.latestRequest?.status === 'PENDING';

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
    if (requestingCoachId !== null) return;
    setErrorMessage('');
    setFeedbackMessage('');
    setRequestingCoachId(coachId);
    try {
      const res = await fetch('/api/athlete/coach-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId }),
      });
      const payload = (await res.json().catch(() => ({ error: 'Failed to send request.' }))) as { error?: string };

      if (res.ok) {
        await loadRequestState();
        setFeedbackMessage('Request pending.');
        return;
      }

      if (res.status === 409) {
        await loadRequestState();
        setErrorMessage(payload.error ?? 'Request already pending');
        return;
      }

      setErrorMessage(payload.error ?? 'Failed to send request.');
    } catch {
      setErrorMessage('Failed to send request. Please try again.');
    } finally {
      setRequestingCoachId(null);
    }
  }

  return (
    <PageShell>
      <TopBar
        eyebrow="Coach discovery"
        title="Search coaches"
      />
      <Surface>
        {requestState.latestRequest?.status === 'PENDING' ? (
          <div className="mb-4 rounded-[12px] border border-[#DCE0D2] bg-[var(--brand-tint)] px-4 py-3 text-sm text-[#57654E]">
            Request pending with {requestState.latestRequest.coach.name}.
          </div>
        ) : null}

        {feedbackMessage ? <p className={`mb-4 ${successTextClassName}`}>{feedbackMessage}</p> : null}
        {errorMessage ? <p className={`mb-4 ${dangerTextClassName}`}>{errorMessage}</p> : null}

        <div className="mb-4 rounded-[12px] border border-dashed border-[var(--field-border)] bg-[var(--field-surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          Messaging coming soon.
        </div>

        <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className={`${formFieldClassName} min-w-0 flex-1`}
          />
          <button
            type="submit"
            disabled={loading}
            className={`${primaryButtonClassName} w-full sm:w-auto`}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {requestState.latestRequest?.status === 'PENDING' ? (
          <div className="mt-4">
            <ActionLink href="/profile" tone="secondary">
              Back to profile
            </ActionLink>
          </div>
        ) : null}

        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            {results.map((coach) => (
              <div key={coach.id} className="rounded-[12px] border border-[var(--field-border)] bg-[var(--field-surface)] px-4 py-3">
                {requestsByCoachId[coach.id] === 'REJECTED' ? (
                  <p className="mb-2 text-xs text-[var(--status-danger)]">
                    Your last request to this coach was declined. Send request again if you want to retry.
                  </p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text)]">{coach.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{coach.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRequest(coach.id)}
                    disabled={
                      requestingCoachId !== null ||
                      requestsByCoachId[coach.id] === 'PENDING' ||
                      (hasPendingRequest && requestsByCoachId[coach.id] !== 'REJECTED')
                    }
                    className={`${compactPrimaryButtonClassName} w-full sm:w-auto`}
                  >
                    {requestsByCoachId[coach.id] === 'PENDING'
                      ? 'Request pending'
                      : hasPendingRequest
                        ? 'Wait for current request'
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
          <p className="mt-4 text-sm text-[var(--text-secondary)]">No coaches found for &ldquo;{lastSubmittedQuery}&rdquo;.</p>
        )}
      </Surface>
    </PageShell>
  );
}
