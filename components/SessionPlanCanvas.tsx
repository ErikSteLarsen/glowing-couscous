import type { CSSProperties } from 'react';
import { formatDurationExact } from '@/lib/format-duration';

export type SessionPlanBlock = {
  id: number;
  label: string;
  kind: string;
  zone: number;
  durationSec: number;
  reps: number | null;
  targetLabel: string | null;
  targetBasis?: string | null;
  note: string | null;
  skipped: boolean;
  color: string;
  tint: string;
};

export function getSessionBlockStyle(block: Pick<SessionPlanBlock, 'kind' | 'zone'>): CSSProperties {
  if (block.kind === 'pause') {
    return { backgroundColor: 'var(--sunken)', color: 'var(--text-secondary)' };
  }
  const zone = Math.min(Math.max(block.zone, 1), 5);
  return { backgroundColor: `var(--color-zone-${zone}-tint)`, color: 'var(--text)' };
}

export function SessionPlanCanvas({
  blocks,
  size = 'overview',
  activeBlockId,
  completedIds = [],
  skippedIds = [],
}: {
  blocks: SessionPlanBlock[];
  size?: 'overview' | 'live';
  activeBlockId?: number | null;
  completedIds?: number[];
  skippedIds?: number[];
}) {
  const totalSeconds = blocks.reduce((sum, block) => sum + block.durationSec * (block.reps ?? 1), 0);
  const summary = blocks.map((block, index) => {
    const duration = block.durationSec * (block.reps ?? 1);
    const status = skippedIds.includes(block.id) || block.skipped ? 'skipped' : completedIds.includes(block.id) ? 'completed' : 'remaining';
    return `Block ${index + 1}, ${block.label}, ${formatDurationExact(duration)}${block.targetLabel ? `, ${block.targetLabel}` : ''}, ${status}`;
  }).join('; ');
  const chartHeight = size === 'live' ? 'h-[88px] sm:h-[112px]' : 'h-[148px] sm:h-[176px]';

  return (
    <div className="min-w-0 space-y-2" aria-label="Session block sequence">
      <div
        role="img"
        aria-label={`Workout intensity timeline: ${summary || 'No workout blocks'}`}
        className={`flex w-full items-end gap-[2px] overflow-hidden border-b border-[var(--border)] ${chartHeight}`}
      >
        {blocks.map((block) => {
          const active = block.id === activeBlockId;
          const wasSkipped = block.skipped || skippedIds.includes(block.id);
          const done = completedIds.includes(block.id);
          const blockSeconds = Math.max(1, block.durationSec * (block.reps ?? 1));
          const zone = Math.min(Math.max(block.zone, 1), 5);
          const zoneHeight = `${zone * 20}%`;

          return (
            <div
              key={block.id}
              aria-hidden="true"
              className={`relative flex h-full min-w-0 flex-col justify-end ${block.kind === 'pause' ? 'min-w-[5px]' : ''}`}
              style={{ flexGrow: blockSeconds, flexBasis: 0 }}
            >
              <div
                className={`training-chart-bar relative w-full border-r border-[var(--surface)] ${block.kind === 'pause' ? 'h-[15px] bg-[var(--text-muted)]' : `ink-zone-${zone}`} ${done ? 'opacity-65' : ''}`}
                style={block.kind === 'pause' ? undefined : { height: zoneHeight }}
              >
                {wasSkipped ? (
                  <span
                    className="training-chart-bar absolute inset-0"
                    style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 8px, var(--surface) 8px 10px)', opacity: 0.55 }}
                  />
                ) : null}
                {active ? <span className="training-chart-bar absolute inset-0 border-2 border-[var(--brand)]" /> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="metric-text flex justify-between text-[11px] text-[var(--text-secondary)]">
        <span>Start</span>
        <span>{formatDurationExact(totalSeconds)} sequence</span>
      </div>
    </div>
  );
}
