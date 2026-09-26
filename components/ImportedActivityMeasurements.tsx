'use client';

import { useEffect, useState } from 'react';
import { ActivityMetricPreview } from '@/components/ActivityMetricPreview';
import { dangerTextClassName } from '@/components/ui';
import type { ActivitySeriesPoint } from '@/lib/activity-series';

type Telemetry = { version: 1; distanceMeters: number | null; elevationGainMeters: number | null; points: ActivitySeriesPoint[] };

export function ImportedActivityMeasurements({ activityId, durationSec, sport }: { activityId: number; durationSec: number; sport: string }) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/activity-imports/${activityId}`)
      .then(async (response) => {
        const result = await response.json() as { error?: string; telemetry?: Telemetry };
        if (!response.ok || !result.telemetry) throw new Error(result.error || 'Recorded measurements could not be loaded.');
        return result.telemetry;
      })
      .then((result) => { if (active) setTelemetry(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Recorded measurements could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activityId]);

  if (loading) return <p role="status" className="text-[13px] text-[var(--text-secondary)]">Loading recorded measurements…</p>;
  if (error) return <p role="alert" className={dangerTextClassName}>{error}</p>;
  if (!telemetry) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[var(--text-secondary)]">
        {telemetry.distanceMeters !== null ? <span>Distance · {(telemetry.distanceMeters / 1000).toFixed(2)} km</span> : null}
        {telemetry.elevationGainMeters !== null ? <span>Elevation gain · {Math.round(telemetry.elevationGainMeters)} m</span> : null}
      </div>
      <ActivityMetricPreview points={telemetry.points} durationSec={durationSec} distanceMeters={telemetry.distanceMeters} sport={sport} />
    </div>
  );
}
