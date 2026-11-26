import { Activity, Bike, Dumbbell, Footprints, PersonStanding, Waves, type LucideIcon } from 'lucide-react';
import { getSportLabel } from '@/lib/sport';

const sportMarks: Record<string, { icon: LucideIcon; className: string }> = {
  BIKING: { icon: Bike, className: 'text-[var(--sport-bike)] bg-[color-mix(in_srgb,var(--sport-bike)_16%,transparent)]' },
  RUNNING: { icon: Footprints, className: 'text-[var(--sport-run)] bg-[color-mix(in_srgb,var(--sport-run)_16%,transparent)]' },
  SWIMMING: { icon: Waves, className: 'text-[var(--sport-swim)] bg-[color-mix(in_srgb,var(--sport-swim)_18%,transparent)]' },
  STRENGTH: { icon: Dumbbell, className: 'text-[var(--sport-other)] bg-[color-mix(in_srgb,var(--sport-other)_16%,transparent)]' },
  STRETCHING: { icon: PersonStanding, className: 'text-[var(--sport-other)] bg-[color-mix(in_srgb,var(--sport-other)_16%,transparent)]' },
};
const otherMark = { icon: Activity, className: 'text-[var(--sport-other)] bg-[color-mix(in_srgb,var(--sport-other)_16%,transparent)]' };

export function SportIcon({ sport, size = 16 }: { sport: string; size?: number }) {
  const { icon: Icon } = sportMarks[sport] ?? otherMark;
  return <Icon aria-hidden="true" size={size} strokeWidth={1.8} />;
}

/** Sport name with a small tinted square icon in front, so cards of different sports tell apart at a glance. */
export function SportBadge({ sport }: { sport: string }) {
  const { icon: Icon, className } = sportMarks[sport] ?? otherMark;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[var(--text-secondary)]">
      <span aria-hidden="true" className={`inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] ${className}`}>
        <Icon size={12} strokeWidth={2} />
      </span>
      <span className="truncate">{getSportLabel(sport)}</span>
    </span>
  );
}
