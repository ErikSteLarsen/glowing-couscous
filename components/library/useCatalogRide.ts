'use client';

import { useState } from 'react';
import { toDayKey } from '@/lib/training-load';

type Preparation =
  | { kind: 'idle' | 'pending' }
  | { kind: 'ready'; sessionId: number }
  | { kind: 'error'; message: string };

/** A workout that is copied to today before it starts: a public one by slug, or one of yours by id. */
export type RideCopySource = { kind: 'catalog'; slug: string } | { kind: 'workout'; id: number };

function copyRequest(source: RideCopySource, date: string, requestKey: string) {
  return source.kind === 'catalog'
    ? { url: `/api/athlete/library/${encodeURIComponent(source.slug)}/ride`, body: { date } }
    // The same retry key returns the same copy, so repeated choices in one chooser never add a second one.
    : { url: '/api/athlete/planner/assignments', body: { sourceKind: 'workout', sourceId: source.id, dates: [date], requestKey } };
}

/** Resolves the current chooser's selections to the same local-day copy of a public or saved workout. */
export function useCatalogRide() {
  const [preparation, setPreparation] = useState<Preparation>({ kind: 'idle' });
  const [requestKey] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`));

  async function prepare(source: RideCopySource): Promise<number | null> {
    if (preparation.kind === 'ready') return preparation.sessionId;
    if (preparation.kind === 'pending') return null;

    setPreparation({ kind: 'pending' });
    try {
      const request = copyRequest(source, toDayKey(new Date()), requestKey);
      const response = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      const body: { sessionId?: unknown; sessionIds?: unknown; error?: unknown } | null = await response.json().catch(() => null);
      const sessionId = Array.isArray(body?.sessionIds) ? body.sessionIds[0] : body?.sessionId;
      if (!response.ok || typeof sessionId !== 'number' || !Number.isSafeInteger(sessionId) || sessionId <= 0) {
        throw new Error(typeof body?.error === 'string' ? body.error : 'Could not add this workout to today. Try again.');
      }
      setPreparation({ kind: 'ready', sessionId });
      return sessionId;
    } catch (error) {
      setPreparation({ kind: 'error', message: error instanceof TypeError || !(error instanceof Error)
        ? 'Could not add this workout to today. Try again.'
        : error.message });
      return null;
    }
  }

  return { preparation, prepare, reset: () => setPreparation({ kind: 'idle' }) };
}
