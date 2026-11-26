import type { ReactNode } from 'react';
import { MetricText } from './MetricText';

export function MetricPair({
  label,
  value,
  inline = false,
}: {
  label: string;
  value: ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={inline ? 'flex min-w-0 items-baseline gap-2' : 'min-w-0 space-y-1'}>
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 wrap-anywhere text-sm font-medium text-[var(--text)]">
        <MetricText>{value}</MetricText>
      </dd>
    </div>
  );
}
