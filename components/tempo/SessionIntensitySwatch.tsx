import { getTempoZoneMeta } from '@/lib/tempo-blocks';

export function SessionIntensitySwatch({ zone }: { zone: number }) {
  const safeZone = Math.min(5, Math.max(1, Math.round(zone)));
  const zoneMeta = getTempoZoneMeta(safeZone);

  return (
    <span
      aria-hidden="true"
      title={`Average intensity: ${zoneMeta.label} ${zoneMeta.name}`}
      className={`ink-zone-${safeZone} mt-0.5 h-3 w-1 shrink-0`}
    />
  );
}
