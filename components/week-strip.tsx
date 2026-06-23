import { Badge } from '@/components/ui';

type WeekStripProps = {
  days: Array<{
    shortLabel: string;
    dayNumber: string;
    fullLabel: string;
    sessions: unknown[];
  }>;
  selectedIndex?: number;
  onSelectDay?: (index: number) => void;
};

export function WeekStrip({ days, selectedIndex = 0, onSelectDay }: WeekStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {days.map((day, index) => {
        const selected = index === selectedIndex;
        const isInteractive = Boolean(onSelectDay);
        const className = `rounded-[12px] border p-3 text-left transition ${selected ? 'border-[#DCE0D2] bg-[var(--brand-tint)]' : 'border-[var(--border)] bg-[var(--surface)]'} ${isInteractive ? 'cursor-pointer hover:border-[#D2D8C7] hover:bg-[#FBFAF7]' : ''}`;

        const content = (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{day.shortLabel}</p>
              <p className="mt-1 text-xl font-semibold text-[var(--text)]">{day.dayNumber}</p>
            </div>
            <Badge tone={day.sessions.length > 0 ? 'brand' : 'neutral'}>{day.sessions.length} sessions</Badge>
          </div>
        );

        if (isInteractive) {
          return (
            <button
              key={day.fullLabel}
              type="button"
              onClick={() => onSelectDay?.(index)}
              className={className}
              aria-pressed={selected}
            >
              {content}
            </button>
          );
        }

        return (
          <div key={day.fullLabel} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
