const statusClasses = {
  planned: 'bg-[var(--brand-tint)] text-[var(--field-selected-text)]',
  completed: 'bg-[#E8F1ED] text-[var(--status-success)]',
  adjusted: 'bg-[#F5ECE8] text-[var(--status-danger)]',
  missed: 'bg-[#EAF1F6] text-[#416A88]',
} as const;

export function StatusBadge({
  status,
}: {
  status: keyof typeof statusClasses;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full px-3 text-[12.5px] font-semibold ${statusClasses[status]}`}
    >
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}
