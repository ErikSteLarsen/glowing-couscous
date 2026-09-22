type Segment = {
  key: string;
  zone: number;
  durationSec: number;
  label: string;
  color: string;
};

type SessionBlockBarSize = 'full' | 'card' | 'compact';

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
    full: 'h-[26px]',
    card: 'h-[32px]',
    compact: 'h-[24px]',
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
          className={`ink-zone-${Math.min(Math.max(segment.zone, 1), 5)} transition-[height] duration-150 ease-out`}
          style={{
            flexGrow: Math.max(segment.durationSec, 1),
            height: `${Math.min(Math.max(segment.zone, 1), 5) * 20}%`,
          }}
        />
      ))}
    </div>
  );
}
