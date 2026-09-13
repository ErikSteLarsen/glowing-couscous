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
  const summary = segments.map((segment) => `${segment.label}, ${segment.durationSec} seconds`).join('; ');
  const resolvedSize = size ?? (compact ? 'compact' : 'full');
  const height = {
    full: 'h-[26px]',
    card: 'h-[14px]',
    compact: 'h-[10px]',
  }[resolvedSize];

  return (
    <div
      role="img"
      aria-label={`Workout structure: ${summary}`}
      className={`flex overflow-hidden rounded-[9px] bg-[var(--sunken)] saturate-[.72] ${height}`}
      style={{ gap: '2px' }}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          aria-hidden="true"
          style={{
            flexGrow: Math.max(segment.durationSec, 1),
            background: segment.color,
          }}
        />
      ))}
    </div>
  );
}
