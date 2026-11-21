import { addMonths, startOfMonth } from 'date-fns';

import { athletePlannerService } from '@/lib/athlete-planner-service';
import type { ExistingSessionsByDate } from '@/lib/calendar-placement';
import { fromDayKey, toDayKey } from '@/lib/training-load';

type Workspace = Awaited<ReturnType<typeof athletePlannerService.loadWorkspace>>;

/** Planning workspace for `day`'s month plus the sessions planned there and next month, for the repeated-placement warning. */
export async function loadPlacementWorkspace(userId: number, day: string): Promise<{ workspace: Workspace; existing: ExistingSessionsByDate }> {
  const nextMonth = toDayKey(addMonths(startOfMonth(fromDayKey(day)), 1));
  const [workspace, followingMonth] = await Promise.all([
    athletePlannerService.loadWorkspace(userId, day, { includeWeek: false }),
    athletePlannerService.loadWorkspace(userId, nextMonth, { includeWeek: false }),
  ]);
  const existing: ExistingSessionsByDate = {};
  for (const entry of [...workspace.calendarDays, ...followingMonth.calendarDays]) {
    existing[entry.isoDate] = entry.sessions.map((session) => ({ title: session.title, sport: session.sport }));
  }
  return { workspace, existing };
}
