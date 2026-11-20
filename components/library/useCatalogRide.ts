'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRideAppEnvironment, useRideAppLaunch } from '@/components/RideAppLaunch';
import { toDayKey } from '@/lib/training-load';
import { rideSessionPath } from '@/lib/ride/launch';

export type CatalogRideTarget = 'web' | 'app';

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  return typeof body?.error === 'string' ? body.error : fallback;
}

/**
 * Ride now for a catalog workout: plans it on the rider's local today, then opens the
 * ride in this window (browser or Tempo Ride) or hands it to the desktop app.
 */
export function useCatalogRide(from: 'library' | 'ride') {
  const router = useRouter();
  const { isDesktop } = useRideAppEnvironment();
  const app = useRideAppLaunch();
  const [pending, setPending] = useState<{ slug: string; target: CatalogRideTarget } | null>(null);
  const [error, setError] = useState<{ slug: string; message: string } | null>(null);
  const [launchedSessionId, setLaunchedSessionId] = useState<number | null>(null);

  const ride = useCallback(async (slug: string, target: CatalogRideTarget = 'web') => {
    setPending({ slug, target });
    setError(null);
    try {
      const response = await fetch(`/api/athlete/library/${encodeURIComponent(slug)}/ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: toDayKey(new Date()) }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not plan this ride. Try again.'));
      const { sessionId } = await response.json() as { sessionId: number };
      if (target === 'app' && !isDesktop) {
        setLaunchedSessionId(sessionId);
        app.launch(sessionId, from);
        setPending(null);
        return;
      }
      router.push(rideSessionPath(sessionId, from));
    } catch (caught) {
      setError({ slug, message: caught instanceof Error ? caught.message : 'Could not plan this ride. Try again.' });
      setPending(null);
    }
  }, [app, from, isDesktop, router]);

  return { ride, pending, error, isDesktop, app, launchedSessionId };
}
