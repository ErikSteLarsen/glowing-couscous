import Link from 'next/link';
import { MetricText } from '@/components/tempo/MetricText';
import { formatDuration } from '@/lib/format-duration';
import { homeLoadBarPercent, homeLoadLabel, type HomeTotals, type homeActivityReadout } from '@/lib/home-summary';

export function HomeWeekSummary({ scheduled, completed }: { scheduled: HomeTotals; completed: HomeTotals }) {
  return <>
    <dl className="home-week-summary">
      <div><dt>Scheduled</dt><dd><MetricText>{formatDuration(scheduled.durationSec)}</MetricText><span>{scheduled.count} {scheduled.count === 1 ? 'session' : 'sessions'} · {homeLoadLabel(scheduled)}</span></dd></div>
      <div><dt>Completed</dt><dd><MetricText>{formatDuration(completed.durationSec)}</MetricText><span>{completed.count} {completed.count === 1 ? 'activity' : 'activities'} · {homeLoadLabel(completed)}</span></dd></div>
    </dl>
    {completed.loadUnavailableCount > 0 ? <p className="study-home__readout-detail">Load unavailable for {completed.loadUnavailableCount} completed {completed.loadUnavailableCount === 1 ? 'activity' : 'activities'}.</p> : null}
    <p className="study-home__readout-detail">Scheduled uses calendar dates. Completed uses activity dates and includes standalone imports. Load is estimated from effort and duration.</p>
  </>;
}

export function HomeRecentLoad({ points }: { points: Array<ReturnType<typeof homeActivityReadout>> }) {
  if (points.length === 0) return <p className="study-home__readout-detail">No completed sessions yet.</p>;
  return <>
    <ul className="home-recent-load" aria-label="Estimated load of the latest four completed activities">
      {points.map((point) => <li key={point.id}>
        <Link href={`/athlete/session/${point.sessionId}?from=home`} aria-label={`${point.title}, ${point.dateLabel}, ${point.loadAvailable ? `${point.tss} estimated TSS` : 'load unavailable'}`} title={`${point.title} · ${point.dateLabel} · ${point.sourceLabel}`}>
          <MetricText>{point.loadAvailable ? point.tss : '—'}</MetricText>
          <span className="home-recent-load__track" aria-hidden="true"><span style={{ height: `${homeLoadBarPercent(point, points)}%` }} /></span>
          <span>{point.label}</span>
        </Link>
      </li>)}
    </ul>
    <p className="study-home__readout-detail">Estimated TSS per activity. — means unavailable; 0 is a known zero. This is recent training load, not a fitness measurement.</p>
  </>;
}
