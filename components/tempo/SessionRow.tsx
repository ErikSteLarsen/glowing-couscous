import Link from 'next/link';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

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
  targetLabel?: string | null;
  segments: Array<{
    key: string;
    zone: number;
    durationSec: number;
    label: string;
    color: string;
  }>;
};

export type SessionRowVariant = 'default' | 'compact' | 'month';

const variantStyles: Record<SessionRowVariant, {
  root: string;
  title: string;
  metadata: string;
  metrics: string;
  showBar: boolean;
  barSize: 'card' | 'compact';
}> = {
  default: {
    root: 'ink-session-row space-y-3 rounded-[3px] bg-[var(--surface)] p-4',
    title: 'break-words text-[18px] font-medium leading-[1.2]',
    metadata: 'mt-1 text-[14px]',
    metrics: 'gap-x-4 gap-y-1 text-[14px]',
    showBar: true,
    barSize: 'card',
  },
  compact: {
    root: 'ink-session-row space-y-2 rounded-[3px] bg-[var(--surface)] px-3 py-2.5',
    title: 'break-words text-[13px] font-semibold',
    metadata: 'mt-1 text-[12px]',
    metrics: 'gap-x-3 gap-y-1 text-[12px]',
    showBar: true,
    barSize: 'compact',
  },
  month: {
    root: 'ink-session-row space-y-1 rounded-[3px] bg-[var(--field-surface)] px-2.5 py-2',
    title: 'break-words text-[12px] font-medium leading-[1.25]',
    metadata: 'mt-0.5 text-[11px]',
    metrics: '',
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
  const accessibleName = [
    actionLabel,
    session.title,
    visibleDateLabel,
    showTime ? session.timeLabel : null,
    getSportLabel(session.sport),
    formatDuration(session.durationSec),
    loadLabel,
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
        <div className="flex min-w-0 items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className={`${styles.title} text-[var(--text)]`}>{session.title}</p>
            <p className={`${styles.metadata} text-[var(--text-secondary)]`}>
              {[visibleDateLabel, showTime ? session.timeLabel : null, getSportLabel(session.sport)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        {styles.showBar ? <SessionBlockBar segments={session.segments} size={styles.barSize} /> : null}
        {styles.metrics ? (
          <div className={`flex flex-wrap items-center ${styles.metrics} text-[var(--text-secondary)]`}>
            <MetricText>{formatDuration(session.durationSec)}</MetricText>
            <MetricText>{loadLabel}</MetricText>
            {session.targetLabel ? <span>{session.targetLabel}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
