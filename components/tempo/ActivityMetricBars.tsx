import {
  bucketActivityMetric,
  formatActivityMetricValue,
  type ActivityMetric,
  type ActivitySeriesPoint,
} from '@/lib/activity-series';

export function ActivityMetricBars({
  points,
  metric,
  durationSec,
  distanceMeters,
}: {
  points: ActivitySeriesPoint[];
  metric: ActivityMetric;
  durationSec?: number | null;
  distanceMeters?: number | null;
}) {
  const chart = bucketActivityMetric(points, metric, { durationSec, distanceMeters });
  const sampling = chart.axis === 'time'
    ? `${formatDuration(chart.interval)} intervals`
    : `${chart.interval} m distance intervals`;

  if (chart.buckets.length === 0) {
    return <p className="text-[13px] text-[var(--text-secondary)]">No {chart.label.toLowerCase()} samples are available for this activity.</p>;
  }

  const description = `${chart.label} as ${chart.buckets.length} bars, ${sampling}. Average ${formatActivityMetricValue(metric, chart.average)}; range ${formatActivityMetricValue(metric, chart.min)} to ${formatActivityMetricValue(metric, chart.max)}.`;

  return (
    <section className="min-w-0" aria-label={chart.label}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[13px] font-semibold text-[var(--text)]">{chart.label}</h3>
        <p className="text-[12px] tabular-nums text-[var(--text-secondary)]">
          Avg {formatActivityMetricValue(metric, chart.average)}
          <span className="px-2 text-[var(--text-muted)]" aria-hidden="true">·</span>
          {sampling}
        </p>
      </div>

      <div
        role="img"
        aria-label={description}
        className="flex h-28 items-end gap-px overflow-hidden border-b border-[var(--border)] pb-px sm:h-36"
      >
        {chart.buckets.map((bucket) => {
          const range = chart.axis === 'time'
            ? `${formatDuration(bucket.from)}–${formatDuration(bucket.to)}`
            : `${Math.round(bucket.from)}–${Math.round(bucket.to)} m`;
          const title = `${range}: ${formatActivityMetricValue(metric, bucket.average)} average; ${formatActivityMetricValue(metric, bucket.min)}–${formatActivityMetricValue(metric, bucket.max)} range`;
          return (
            <span
              key={bucket.index}
              aria-hidden="true"
              title={title}
              className="training-chart-bar min-w-[2px] flex-1 bg-[var(--color-signal)]"
              style={{ height: `${bucket.heightPercent}%` }}
            />
          );
        })}
      </div>

      <details className="mt-3 text-[12px] text-[var(--text-secondary)]">
        <summary className="w-fit cursor-pointer rounded-[3px] py-1 font-medium text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-liquid)]">
          View interval data
        </summary>
        <div className="mt-2 max-h-56 min-w-0 overflow-x-hidden overflow-y-auto border-y border-[var(--border)]">
          <table className="w-full table-fixed border-collapse text-left tabular-nums">
            <caption className="sr-only">{description}</caption>
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[30%]" />
              <col className="w-[36%]" />
            </colgroup>
            <thead className="sticky top-0 bg-[var(--surface)] text-[11px] text-[var(--text-muted)]">
              <tr>
                <th className="wrap-anywhere py-2 pr-2 font-medium sm:pr-3">{chart.axis === 'time' ? 'Time' : 'Distance'}</th>
                <th className="wrap-anywhere py-2 pr-2 text-right font-medium sm:pr-3">Average</th>
                <th className="wrap-anywhere py-2 text-right font-medium">Range</th>
              </tr>
            </thead>
            <tbody>
              {chart.buckets.map((bucket) => (
                <tr key={bucket.index} className="border-t border-[var(--border)]">
                  <th scope="row" className="wrap-anywhere py-2 pr-2 font-medium sm:pr-3">
                    {chart.axis === 'time'
                      ? `${formatDuration(bucket.from)}–${formatDuration(bucket.to)}`
                      : `${Math.round(bucket.from)}–${Math.round(bucket.to)} m`}
                  </th>
                  <td className="wrap-anywhere py-2 pr-2 text-right sm:pr-3">{formatActivityMetricValue(metric, bucket.average)}</td>
                  <td className="wrap-anywhere py-2 text-right">{formatActivityMetricValue(metric, bucket.min)}–{formatActivityMetricValue(metric, bucket.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return remainder === 0 ? `${minutes} min` : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
