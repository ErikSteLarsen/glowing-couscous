'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Menu, MenuContent, MenuItemIndicator, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/tempobuilder/Menu';
import { SportIcon } from '@/components/tempobuilder/SportBadge';
import { buttonFocusClassName } from '@/components/ui';
import { sportWorkoutsLabel } from '@/components/library/CollectionToolbar';
import { catalogSportLabel, isWorkoutSport, WORKOUT_SPORTS, type WorkoutSport } from '@/lib/workout-catalog/query';

/**
 * The page's sport, beside the Workouts title: a ghost control (no border or fill
 * until hovered or open) with a brand chevron, so it reads as a menu without
 * competing with the tabs. Other is listed only when saved workouts use it.
 */
export function WorkoutSportChooser({ sport, counts, showOther, onChange }: {
  sport: WorkoutSport;
  counts: Record<WorkoutSport, number>;
  showOther: boolean;
  onChange: (sport: WorkoutSport) => void;
}) {
  const sports = WORKOUT_SPORTS.filter(({ id }) => id !== 'OTHER' || showOther || sport === 'OTHER');
  return (
    <Menu>
      <MenuTrigger
        aria-label={`${sportWorkoutsLabel(sport)}, change sport`}
        className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-base font-medium text-[var(--text)] transition-colors control-hover:bg-[var(--raised)] aria-expanded:bg-[var(--raised)] max-md:min-h-11 ${buttonFocusClassName}`}
      >
        <SportIcon sport={sport} size={18} />
        {catalogSportLabel(sport)}
        <ChevronDown aria-hidden="true" size={16} strokeWidth={2} className="text-[var(--brand)]" />
      </MenuTrigger>
      <MenuContent align="start">
        <MenuRadioGroup aria-label="Sport" value={sport} onValueChange={(value) => { if (isWorkoutSport(value) && value !== sport) onChange(value); }}>
          {sports.map(({ id }) => (
            <MenuRadioItem key={id} value={id} closeOnSelect>
              <MenuItemIndicator><Check aria-hidden="true" size={16} strokeWidth={1.8} /></MenuItemIndicator>
              <SportIcon sport={id} />
              <span className="flex-1">{sportWorkoutsLabel(id)}</span>
              <span className="data text-[13px] text-[var(--text-muted)]">{counts[id]}</span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
