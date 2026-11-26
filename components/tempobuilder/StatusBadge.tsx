const statusClasses = {
  planned: 'border-[var(--status-planned-border)] bg-[var(--status-planned-tint)] text-[var(--status-planned)]',
  adjusted: 'border-[var(--status-adjusted-border)] bg-[var(--status-adjusted-tint)] text-[var(--status-adjusted)]',
  missed: 'border-[var(--status-missed-border)] bg-[var(--status-missed-tint)] text-[var(--status-missed)]',
  skipped: 'border-[var(--border-strong)] bg-[var(--raised)] text-[var(--text-secondary)]',
} as const;

type Status = keyof typeof statusClasses | 'completed';

export function StatusBadge({
  status,
}: {
  status: Status;
}) {
  if (status === 'completed') return null;

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-3 text-[12.5px] font-semibold shadow-[var(--shadow-inset)] ${statusClasses[status]}`}
    >
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}
