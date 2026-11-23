import type { ActivityIntensityTimeline } from '@/lib/activity-series';
import { intensityColor } from '@/lib/intensity-color';
import { OLYMPIATOPPEN_HEART_RATE_PERCENT_BANDS } from '@/lib/profile-training-zones';
import type { TempoZone } from '@/lib/tempo-blocks';

export function ActivityIntensityBars({ timeline, compact = false }: { timeline: ActivityIntensityTimeline; compact?: boolean }) {
  const intervalLabel = timeline.intervalSec >= 60
    ? `${Math.round(timeline.intervalSec / 60)}\u00A0min`
    : `${timeline.intervalSec} sec`;
  const zoneDescription = timeline.maxHeartRateBpm
    ? `Zone colors use the saved maximum heart rate of ${timeline.maxHeartRateBpm}\u00A0bpm.`
    : 'Bar height shows recorded heart-rate changes; zone colors are unavailable without a saved maximum heart rate.';
  const description = `Recorded heart-rate intensity, ${timeline.bins.length} intervals of ${intervalLabel}. Average ${timeline.averageBpm}\u00A0bpm, range ${timeline.minBpm} to ${timeline.maxBpm}\u00A0bpm. ${zoneDescription}`;

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1.5'}>
      <div className={`flex flex-wrap items-baseline ${compact ? 'justify-end' : 'justify-between'} gap-x-2 text-[11px] leading-4 text-[var(--text-secondary)]`}>
        {compact ? null : <span className="font-medium text-[var(--text)]">Heart rate</span>}
        <span className="tabular-nums">{compact ? `Avg HR ${timeline.averageBpm}\u00A0bpm` : `Avg ${timeline.averageBpm}\u00A0bpm · ${intervalLabel}`}</span>
      </div>
      <div
        role="img"
        aria-label={description}
        className={`flex ${compact ? 'h-5' : 'h-9'} items-end gap-px overflow-hidden border-b border-[var(--border)] pb-px`}
      >
        {timeline.bins.map((bin) => {
          const range = `${formatDuration(bin.from)}–${formatDuration(bin.to)}`;
          const title = bin.averageBpm === null
            ? `${range}: no heart-rate samples`
            : `${range}: ${bin.averageBpm}\u00A0bpm average, ${bin.minBpm}–${bin.maxBpm}\u00A0bpm range${bin.zone ? `, Zone ${bin.zone}` : ''}`;
          const band = bin.zone ? OLYMPIATOPPEN_HEART_RATE_PERCENT_BANDS[bin.zone as TempoZone] : null;
          const heartRatePercent = bin.averageBpm !== null && timeline.maxHeartRateBpm
            ? bin.averageBpm / timeline.maxHeartRateBpm * 100 : null;
          const fraction = band && heartRatePercent !== null
            ? (heartRatePercent - band.low) / (band.high - band.low) : 0.5;
          return (
            <span
              key={bin.index}
              aria-hidden="true"
              title={title}
              className={`training-chart-bar min-w-[2px] flex-1 ${bin.averageBpm === null ? 'bg-transparent' : bin.zone ? '' : 'bg-[var(--color-signal)]'}`}
              style={{ height: `${bin.heightPercent ?? 0}%`, backgroundColor: bin.zone ? intensityColor(bin.zone, fraction) : undefined }}
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
  return remainder === 0 ? `${minutes}\u00A0min` : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
