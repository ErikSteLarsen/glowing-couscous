import { Badge } from '@/components/ui';

type WeekStripProps = {
  days: Array<{
    shortLabel: string;
    dayNumber: string;
    fullLabel: string;
    sessions: unknown[];
  }>;
  selectedIndex?: number;
};

export function WeekStrip({ days, selectedIndex = 0 }: WeekStripProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
      {days.map((day, index) => {
        const selected = index === selectedIndex;
        return (
          <div
            key={day.fullLabel}
            className={`rounded-2xl border p-3 ${selected ? 'border-[rgba(90,124,255,0.4)] bg-[rgba(90,124,255,0.14)]' : 'border-white/10 bg-white/5'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{day.shortLabel}</p>
                <p className="mt-1 text-xl font-semibold text-white">{day.dayNumber}</p>
              </div>
              <Badge tone={day.sessions.length > 0 ? 'brand' : 'neutral'}>{day.sessions.length} sessions</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
