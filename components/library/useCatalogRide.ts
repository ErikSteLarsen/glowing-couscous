'use client';

import { useState } from 'react';
import { toDayKey } from '@/lib/training-load';

type Preparation =
  | { kind: 'idle' | 'pending' }
  | { kind: 'ready'; sessionId: number }
  | { kind: 'error'; message: string };

/** A workout to start that isn't in the Calendar: a public one by slug, or one of yours by id. */
export type StartableSource = { kind: 'catalog'; slug: string } | { kind: 'workout'; id: number };

function startUrl(source: StartableSource) {
  return source.kind === 'catalog'
    ? `/api/athlete/library/${encodeURIComponent(source.slug)}/ride`
    : `/api/athlete/workouts/${source.id}/start`;
}

/** Gets the session to follow or ride. Nothing is added to the Calendar until its result is saved. */
export function useCatalogRide() {
  const [preparation, setPreparation] = useState<Preparation>({ kind: 'idle' });

  async function prepare(source: StartableSource): Promise<number | null> {
    if (preparation.kind === 'ready') return preparation.sessionId;
    if (preparation.kind === 'pending') return null;

    setPreparation({ kind: 'pending' });
    try {
      const response = await fetch(startUrl(source), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: toDayKey(new Date()) }),
      });
      const body: { sessionId?: unknown; error?: unknown } | null = await response.json().catch(() => null);
      const sessionId = body?.sessionId;
      if (!response.ok || typeof sessionId !== 'number' || !Number.isSafeInteger(sessionId) || sessionId <= 0) {
        throw new Error(typeof body?.error === 'string' ? body.error : 'Could not open this workout. Try again.');
      }
      setPreparation({ kind: 'ready', sessionId });
      return sessionId;
    } catch (error) {
      setPreparation({ kind: 'error', message: error instanceof TypeError || !(error instanceof Error)
        ? 'Could not open this workout. Try again.'
        : error.message });
      return null;
    }
  }

  return { preparation, prepare, reset: () => setPreparation({ kind: 'idle' }) };
}
