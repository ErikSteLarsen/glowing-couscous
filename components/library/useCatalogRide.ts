'use client';

import { useState } from 'react';
import { toDayKey } from '@/lib/training-load';

type Preparation =
  | { kind: 'idle' | 'pending' }
  | { kind: 'ready'; sessionId: number }
  | { kind: 'error'; message: string };

/** Resolves the current chooser's selections to the same local-day catalog copy. */
export function useCatalogRide() {
  const [preparation, setPreparation] = useState<Preparation>({ kind: 'idle' });

  async function prepare(slug: string): Promise<number | null> {
    if (preparation.kind === 'ready') return preparation.sessionId;
    if (preparation.kind === 'pending') return null;

    setPreparation({ kind: 'pending' });
    try {
      const response = await fetch(`/api/athlete/library/${encodeURIComponent(slug)}/ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: toDayKey(new Date()) }),
      });
      const body: { sessionId?: unknown; error?: unknown } | null = await response.json().catch(() => null);
      const sessionId = body?.sessionId;
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
