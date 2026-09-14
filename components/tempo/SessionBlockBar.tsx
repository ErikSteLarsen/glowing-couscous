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
  const isIntensityTimeline = resolvedSize !== 'full';
  const summary = segments.map((segment) => `Zone ${segment.zone}: ${segment.label}, ${segment.durationSec} seconds`).join('; ');
  const height = {
    full: 'h-[26px]',
    card: 'h-[32px]',
    compact: 'h-[24px]',
  }[resolvedSize];

  return (
    <div
      role="img"
      aria-label={`${isIntensityTimeline ? 'Workout intensity timeline' : 'Workout structure'}: ${summary}`}
      className={`flex w-full max-w-[18rem] items-end overflow-hidden ${isIntensityTimeline ? 'rounded-none' : 'rounded-[9px]'} bg-transparent saturate-[.72] ${height}`}
      style={{ gap: '2px' }}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          aria-hidden="true"
          className={isIntensityTimeline ? 'transition-[height] duration-150 ease-out' : undefined}
          style={{
            flexGrow: Math.max(segment.durationSec, 1),
            background: segment.color,
            height: isIntensityTimeline ? `${Math.min(Math.max(segment.zone, 1), 5) * 20}%` : '100%',
          }}
        />
      ))}
    </div>
  );
}
