import type { ComplianceState } from '@/lib/training-load';
import { complianceLabels } from '@/lib/training-load';

export const complianceColors: Record<ComplianceState, string> = {
  complete: 'var(--compliance-good)',
  partial: 'var(--compliance-partial)',
  off: 'var(--compliance-off)',
  missed: 'var(--status-missed)',
  planned: 'var(--border-strong)',
  unplanned: 'var(--text-muted)',
};

/** A small state dot with its meaning as text, so color is never the only signal. */
export function ComplianceMark({
  state,
  showLabel = false,
  className = '',
}: {
  state: ComplianceState;
  showLabel?: boolean;
  className?: string;
}) {
  const hollow = state === 'planned';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] ${className}`}>
      <span
        aria-hidden="true"
        className="inline-block size-2 shrink-0 rounded-full"
        style={hollow ? { boxShadow: `inset 0 0 0 1.5px ${complianceColors[state]}` } : { background: complianceColors[state] }}
      />
      <span className={showLabel ? '' : 'sr-only'}>{complianceLabels[state]}</span>
    </span>
  );
}
