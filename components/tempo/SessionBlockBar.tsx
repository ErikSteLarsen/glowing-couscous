type Segment = {
  key: string;
  zone: number;
  durationSec: number;
  label: string;
  color: string;
};

export function SessionBlockBar({
  segments,
  compact = false,
}: {
  segments: Segment[];
  compact?: boolean;
}) {
  return (
    <div
      className={`flex overflow-hidden rounded-[9px] bg-[var(--sunken)] ${compact ? 'h-[10px]' : 'h-[26px]'}`}
      style={{ gap: '2px' }}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          aria-label={`${segment.label} ${segment.durationSec} seconds`}
          style={{
            flexGrow: Math.max(segment.durationSec, 1),
            background: segment.color,
          }}
        />
      ))}
    </div>
  );
}
