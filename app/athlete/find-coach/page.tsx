'use client';
import { useState } from 'react';
import { PageShell, Surface, TopBar } from '@/components/ui';
import { SignOutButton } from '@/components/SignOutButton';

type CoachResult = { id: number; name: string; email: string };

export default function FindCoachPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoachResult[]>([]);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');
  const [requested, setRequested] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/coaches?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.coaches ?? []);
    setLastSubmittedQuery(query);
    setLoading(false);
  }

  async function handleRequest(coachId: number) {
    const res = await fetch('/api/athlete/coach-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId }),
    });
    if (res.ok || res.status === 409) {
      setRequested((prev) => new Set(prev).add(coachId));
    }
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

        {results.length > 0 && (
          <div className="mt-4 space-y-3">
            {results.map((coach) => (
              <div
                key={coach.id}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{coach.name}</p>
                  <p className="text-xs text-slate-400">{coach.email}</p>
                </div>
                <button
                  onClick={() => handleRequest(coach.id)}
                  disabled={requested.has(coach.id)}
                  className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {requested.has(coach.id) ? 'Request sent' : 'Request to join'}
                </button>
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
