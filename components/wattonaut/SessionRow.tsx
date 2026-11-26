import Link from 'next/link';
import { ActivityIntensityBars } from '@/components/wattonaut/ActivityIntensityBars';
import { ComplianceMark } from '@/components/wattonaut/ComplianceMark';
import { MetricText } from '@/components/wattonaut/MetricText';
import { SessionBlockBar } from '@/components/wattonaut/SessionBlockBar';
import { SessionIntensitySwatch } from '@/components/wattonaut/SessionIntensitySwatch';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { getAverageSessionZone } from '@/lib/session-intensity';
import { getTempoZoneMeta } from '@/lib/tempo-blocks';
import type { ActivityIntensityTimeline } from '@/lib/activity-series';
import { complianceLabels, type ComplianceState } from '@/lib/training-load';

type SessionStatus = 'planned' | 'completed' | 'adjusted' | 'missed' | 'skipped';

type SessionRowData = {
  id: number;
  title: string;
  sport: string;
  timeLabel: string | null;
  dateLabel?: string;
  status: SessionStatus;
  durationSec: number;
  tss: number | null;
  loadAvailable?: boolean;
  intensityTimeline?: ActivityIntensityTimeline | null;
  targetLabel?: string | null;
  compliance?: ComplianceState;
  segments: Array<{
    key: string;
    zone: number;
    durationSec: number;
    label: string;
    color: string;
  }>;
};

export function SessionRow({
  session,
  href,
  actionLabel = 'Open workout',
  variant = 'compact',
}: {
  session: SessionRowData;
  href: string;
  actionLabel?: string;
  /** `day` is the month row with one line of stats, for a single full-width day. */
  variant?: 'compact' | 'month' | 'day';
}) {
  const month = variant === 'month' || variant === 'day';
  const loadUnavailable = session.loadAvailable === false || session.tss === null;
  const loadLabel = loadUnavailable ? 'No TSS' : `${session.tss}\u00A0TSS`;
  const averageZone = month ? getAverageSessionZone(session.segments) : null;
  const averageZoneMeta = averageZone ? getTempoZoneMeta(averageZone) : null;
  const accessibleName = [
    actionLabel,
    session.title,
    session.dateLabel,
    session.timeLabel,
    getSportLabel(session.sport),
    formatDuration(session.durationSec),
    loadLabel,
    averageZoneMeta ? `Average intensity ${averageZoneMeta.label} ${averageZoneMeta.name}; pause time excluded` : null,
    session.intensityTimeline ? `Average heart rate ${session.intensityTimeline.averageBpm}\u00A0bpm` : null,
    session.targetLabel,
    session.compliance ? complianceLabels[session.compliance] : session.status,
  ].filter(Boolean).join(', ');

  return (
    <Link
      href={href}
      aria-label={accessibleName}
      className={`group ink-session-row block min-w-0 rounded-lg border border-[var(--border)] transition hover:border-[var(--border-strong)] hover:bg-[var(--raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] ${month ? 'ink-session-row--calendar bg-[var(--field-surface)] px-2.5 py-2' : 'bg-[var(--surface)] px-3 py-2.5'}`}
    >
      <div className={`flex min-w-0 items-start ${averageZone ? 'gap-1.5' : 'gap-3'}`}>
        {averageZone ? <SessionIntensitySwatch zone={averageZone} /> : null}
        <div className="min-w-0 flex-1">
          <p
            title={month ? session.title : undefined}
            className={`${month ? 'break-words text-xs font-medium leading-[1.25]' : 'break-words text-[13px] font-semibold'} text-[var(--text)]`}
          >
            {session.title}
          </p>
          {!month ? (
            <p className="data mt-1 text-xs text-[var(--text-secondary)]">
              {[session.dateLabel, session.timeLabel, getSportLabel(session.sport)].filter(Boolean).join('\u00A0– ')}
            </p>
          ) : null}
          {variant === 'day' ? (
            <p className="data mt-0.5 text-xs text-[var(--text-secondary)]">
              {[session.timeLabel, getSportLabel(session.sport), formatDuration(session.durationSec), loadLabel].filter(Boolean).join('\u00A0– ')}
            </p>
          ) : null}
        </div>
        {session.compliance ? <ComplianceMark state={session.compliance} showLabel={session.status === 'skipped'} className="mt-1" /> : null}
      </div>
      {!month ? (
        <>
          {session.intensityTimeline?.bins.length
            ? <ActivityIntensityBars timeline={session.intensityTimeline} />
            : <SessionBlockBar segments={session.segments} size="compact" />}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
            <MetricText>{formatDuration(session.durationSec)}</MetricText>
            <MetricText>{loadLabel}</MetricText>
            {session.targetLabel ? <span>{session.targetLabel}</span> : null}
          </div>
        </>
      ) : null}
    </Link>
  );
}
