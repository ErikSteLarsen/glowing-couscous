const statusClasses = {
  planned: 'bg-[var(--brand-tint)] text-[#57654E]',
  completed: 'bg-[#E3F7EC] text-[#1B7A3D]',
  adjusted: 'bg-[#FEEDE0] text-[#B45516]',
  missed: 'bg-[#E8F0FE] text-[#2B6CB0]',
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
