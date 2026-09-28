import Link from 'next/link';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { ActivityIntensityBars } from '@/components/tempo/ActivityIntensityBars';
import { SessionIntensitySwatch } from '@/components/tempo/SessionIntensitySwatch';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { getAverageSessionZone } from '@/lib/session-intensity';
import { getTempoZoneMeta } from '@/lib/tempo-blocks';
import type { ActivityIntensityTimeline } from '@/lib/activity-series';

type SessionStatus = 'planned' | 'completed' | 'adjusted' | 'missed';

export type SessionRowData = {
  id: number;
  title: string;
  sport: string;
  timeLabel: string;
  dateLabel?: string;
  status: SessionStatus;
  durationSec: number;
  tss: number;
  loadAvailable?: boolean;
  intensityTimeline?: ActivityIntensityTimeline | null;
  targetLabel?: string | null;
  segments: Array<{
    key: string;
    zone: number;
    durationSec: number;
    label: string;
    color: string;
  }>;
};

export type SessionRowVariant = 'default' | 'compact' | 'calendar' | 'month';

const variantStyles: Record<SessionRowVariant, {
  root: string;
  title: string;
  metadata: string;
  metrics: string;
  showMetadata: boolean;
  showBar: boolean;
  barSize: 'card' | 'compact' | 'calendar';
}> = {
  default: {
    root: 'ink-session-row space-y-3 rounded-[3px] bg-[var(--surface)] p-4',
    title: 'break-words text-[18px] font-medium leading-[1.2]',
    metadata: 'mt-1 text-[14px]',
    metrics: 'gap-x-4 gap-y-1 text-[14px]',
    showMetadata: true,
    showBar: true,
    barSize: 'card',
  },
  compact: {
    root: 'ink-session-row space-y-2 rounded-[3px] bg-[var(--surface)] px-3 py-2.5',
    title: 'break-words text-[13px] font-semibold',
    metadata: 'mt-1 text-[12px]',
    metrics: 'gap-x-3 gap-y-1 text-[12px]',
    showMetadata: true,
    showBar: true,
    barSize: 'compact',
  },
  calendar: {
    root: 'ink-session-row ink-session-row--calendar rounded-[3px] bg-[var(--surface)] px-3 py-2.5',
    title: 'break-words text-[13px] font-semibold leading-5',
    metadata: 'mt-0.5 text-[11px] leading-4',
    metrics: 'gap-x-2.5 gap-y-0 text-[11px] leading-4',
    showMetadata: true,
    showBar: true,
    barSize: 'calendar',
  },
  month: {
    root: 'ink-session-row ink-session-row--calendar rounded-[3px] bg-[var(--field-surface)] px-1.5 py-1',
    title: 'truncate text-[11px] font-medium leading-4',
    metadata: '',
    metrics: '',
    showMetadata: false,
    showBar: false,
    barSize: 'compact',
  },
};

export function SessionRow({
  session,
  href,
  actionLabel = 'Open session',
  variant,
  compact,
  dateLabel,
  muted = false,
  showTime = true,
}: {
  session: SessionRowData;
  href: string;
  actionLabel?: string;
  variant?: SessionRowVariant;
  /** @deprecated Use `variant="compact"` instead. */
  compact?: boolean;
  dateLabel?: string;
  muted?: boolean;
  showTime?: boolean;
}) {
  const resolvedVariant = variant ?? (compact ? 'compact' : 'default');
  const styles = variantStyles[resolvedVariant];
  const visibleDateLabel = dateLabel ?? session.dateLabel;
  const loadLabel = session.loadAvailable === false ? 'Load unavailable' : `${session.tss} TSS`;
  const averageZone = resolvedVariant === 'calendar' || resolvedVariant === 'month'
    ? getAverageSessionZone(session.segments)
    : null;
  const averageZoneMeta = averageZone ? getTempoZoneMeta(averageZone) : null;
  const accessibleName = [
    actionLabel,
    session.title,
    visibleDateLabel,
    showTime ? session.timeLabel : null,
    getSportLabel(session.sport),
    formatDuration(session.durationSec),
    loadLabel,
    averageZoneMeta ? `Average intensity ${averageZoneMeta.label} ${averageZoneMeta.name}; pause time excluded` : null,
    session.intensityTimeline ? `Average heart rate ${session.intensityTimeline.averageBpm} bpm` : null,
    session.targetLabel,
    session.status,
  ].filter(Boolean).join(', ');

  return (
    <Link
      href={href}
      aria-label={accessibleName}
      className={`group block min-w-0 border border-[var(--border)] transition hover:border-[var(--field-focus)] hover:bg-[var(--field-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${styles.root}`}
    >
      <div className={muted ? 'opacity-70' : undefined}>
        <div className={`flex min-w-0 items-start ${averageZone ? 'gap-1.5' : 'gap-3'}`}>
          {averageZone ? <SessionIntensitySwatch zone={averageZone} /> : null}
          <div className="min-w-0 flex-1">
            <p
              title={resolvedVariant === 'calendar' || resolvedVariant === 'month' ? session.title : undefined}
              className={`${styles.title} text-[var(--text)]`}
            >
              {session.title}
            </p>
            {styles.showMetadata ? (
              <p className={`${styles.metadata} text-[var(--text-secondary)]`}>
                {[visibleDateLabel, showTime ? session.timeLabel : null, getSportLabel(session.sport)].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </div>
        </div>
        {styles.showBar ? (
          session.intensityTimeline?.bins.length
            ? <div className={resolvedVariant === 'calendar' ? 'mt-1' : undefined}>
                <ActivityIntensityBars timeline={session.intensityTimeline} compact={resolvedVariant === 'calendar'} />
              </div>
            : <SessionBlockBar segments={session.segments} size={styles.barSize} />
        ) : null}
        {styles.metrics ? (
          <div className={`flex flex-wrap items-center ${styles.metrics} ${resolvedVariant === 'calendar' ? 'mt-1' : ''} text-[var(--text-secondary)]`}>
            <MetricText>{formatDuration(session.durationSec)}</MetricText>
            {resolvedVariant === 'calendar' && session.loadAvailable === false
              ? <span title={loadLabel}>Load n/a</span>
              : <MetricText>{loadLabel}</MetricText>}
            {session.targetLabel ? <span>{session.targetLabel}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
