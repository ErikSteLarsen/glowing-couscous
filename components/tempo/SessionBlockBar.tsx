import { intensityColor } from '@/lib/intensity-color';

type Segment = {
  key: string;
  zone: number;
  durationSec: number;
  label: string;
  color: string;
  intensityFraction?: number;
};

type SessionBlockBarSize = 'authoring' | 'full' | 'card' | 'compact' | 'calendar';

export function SessionBlockBar({
  segments,
  size,
  compact = false,
}: {
  segments: Segment[];
  size?: SessionBlockBarSize;
  /** @deprecated Use `size="compact"` instead. */
  compact?: boolean;
}) {
  const resolvedSize = size ?? (compact ? 'compact' : 'full');
  const summary = segments.map((segment) => `Zone ${segment.zone}: ${segment.label}, ${segment.durationSec} seconds`).join('; ');
  const height = {
    authoring: 'h-40 px-1 pt-2',
    full: 'h-[26px]',
    card: 'h-[32px]',
    compact: 'h-[24px]',
    calendar: 'h-4',
  }[resolvedSize];

  return (
    <div
      role="img"
      aria-label={`Workout intensity timeline: ${summary}`}
      className={`flex w-full items-end overflow-hidden border-b border-[var(--border)] bg-transparent ${height}`}
      style={{ gap: '2px' }}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          aria-hidden="true"
          className="transition-[height,background-color] duration-150 ease-out"
          style={{
            flexGrow: Math.max(segment.durationSec, 1),
            height: segment.label === 'Pause' ? '14%' : `${30 + (Math.min(Math.max(segment.zone, 1), 5) - 1 + (segment.intensityFraction ?? 0.5)) * 14}%`,
            backgroundColor: segment.label === 'Pause' ? 'var(--text-muted)' : intensityColor(segment.zone, segment.intensityFraction),
          }}
        />
      ))}
    </div>
  );
}
