import type { ActivityIntensityTimeline } from '@/lib/activity-series';

export function ActivityIntensityBars({ timeline }: { timeline: ActivityIntensityTimeline }) {
  const intervalLabel = timeline.intervalSec >= 60
    ? `${Math.round(timeline.intervalSec / 60)} min`
    : `${timeline.intervalSec} sec`;
  const zoneDescription = timeline.maxHeartRateBpm
    ? `Zone colors use the saved maximum heart rate of ${timeline.maxHeartRateBpm} bpm.`
    : 'Bar height shows recorded heart-rate changes; zone colors are unavailable without a saved maximum heart rate.';
  const description = `Recorded heart-rate intensity, ${timeline.bins.length} intervals of ${intervalLabel}. Average ${timeline.averageBpm} bpm, range ${timeline.minBpm} to ${timeline.maxBpm} bpm. ${zoneDescription}`;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[11px] leading-4 text-[var(--text-secondary)]">
        <span className="font-medium text-[var(--text)]">Heart rate</span>
        <span className="tabular-nums">Avg {timeline.averageBpm} bpm · {intervalLabel}</span>
      </div>
      <div
        role="img"
        aria-label={description}
        className="flex h-9 items-end gap-px overflow-hidden border-b border-[var(--border)] pb-px"
      >
        {timeline.bins.map((bin) => {
          const range = `${formatDuration(bin.from)}–${formatDuration(bin.to)}`;
          const title = bin.averageBpm === null
            ? `${range}: no heart-rate samples`
            : `${range}: ${bin.averageBpm} bpm average, ${bin.minBpm}–${bin.maxBpm} bpm range${bin.zone ? `, Zone ${bin.zone}` : ''}`;
          return (
            <span
              key={bin.index}
              aria-hidden="true"
              title={title}
              className={`min-w-[2px] flex-1 ${bin.averageBpm === null ? 'bg-transparent' : bin.zone ? `ink-zone-${bin.zone}` : 'bg-[var(--color-signal)]'}`}
              style={{ height: `${bin.heightPercent ?? 0}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return remainder === 0 ? `${minutes} min` : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
