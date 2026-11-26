import Link from 'next/link';
import { CalendarPlus, Ellipsis, Pencil } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/wattonaut/Menu';
import { iconButtonClassName } from '@/components/ui';
import { withBackOrigin } from '@/lib/app-navigation';
import { customizeWorkoutHref } from '@/lib/athlete-workouts-navigation';
import type { CatalogSport } from '@/lib/workout-catalog/types';

export function catalogScheduleHref(slug: string, from: 'library' | 'ride') {
  return withBackOrigin(`/athlete/library/${encodeURIComponent(slug)}/schedule`, from);
}

export function LibraryWorkoutMenu({ slug, sport, name, from, showSchedule = false }: { slug: string; sport: CatalogSport; name: string; from: 'library' | 'ride'; showSchedule?: boolean }) {
  return (
    <Menu>
      <MenuTrigger aria-label={`More options for ${name}`} className={`${iconButtonClassName} max-md:size-11`}>
        <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem render={<Link href={customizeWorkoutHref(slug, sport)} prefetch={false} />}>
          <Pencil aria-hidden="true" size={16} strokeWidth={1.6} />Customize
        </MenuItem>
        {showSchedule ? (
          <MenuItem render={<Link href={catalogScheduleHref(slug, from)} prefetch={false} />}>
            <CalendarPlus aria-hidden="true" size={16} strokeWidth={1.6} />Schedule
          </MenuItem>
        ) : null}
      </MenuContent>
    </Menu>
  );
}
