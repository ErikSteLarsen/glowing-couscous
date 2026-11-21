import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginPathFor } from '@/lib/auth-callback';
import { format, parseISO } from 'date-fns';
import { ArrowRight, CalendarDays, Ellipsis, House, RotateCcw } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { publicLibraryHref } from '@/lib/athlete-workouts-navigation';
import { LibraryCard } from '@/components/library/LibraryCard';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempo/Menu';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { buttonFocusClassName, compactSecondaryButtonClassName, Disclosure, ghostButtonClassName, iconButtonClassName, primaryButtonClassName, secondaryButtonClassName, sectionHeadingClassName } from '@/components/ui';
import { WorkoutStartChooser } from '@/components/WorkoutStartChooser';
import { UnsavedRidesNotice } from '@/components/UnsavedRidesNotice';
import { accountService } from '@/lib/account-service';
import { getCurrentUser } from '@/lib/auth-session';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { formatDuration } from '@/lib/format-duration';
import { rideHubService, type RideHubRecent, type RideHubSession } from '@/lib/ride-hub-service';
import { fromDayKey } from '@/lib/training-load';
import { workoutCatalog } from '@/lib/workout-catalog';
import { createCatalogListEntries, parseCatalogQuery } from '@/lib/workout-catalog/query';

export const metadata: Metadata = { title: 'Ride' };

const previewSlugs = new Set(['gentle-spin-30', 'steady-aerobic-hour-60', 'warm-graphite']);
const catalogPreview = createCatalogListEntries(workoutCatalog.filter((workout) => previewSlugs.has(workout.slug)));

export default async function RideHubPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect(loginPathFor('/athlete/ride'));

  const [hub, account, params] = await Promise.all([getRequestTimeZone().then((timeZone) => rideHubService.load(user.id, { timeZone })), accountService.getAccount(user.id), searchParams]);
  const ftp = account?.performanceProfile.cycling.ftpWatts ?? null;
  const [firstToday, ...laterToday] = hub.todaySessions;
  const earlierCount = hub.overdueSessions.length + hub.recent.length;
  const libraryHref = publicLibraryHref(parseCatalogQuery(params));
  const ftpLink = (
    <Link href="/profile#cycling" className={`${ghostButtonClassName('compact')} max-md:min-h-11`}>
      {ftp ? `FTP ${ftp} W` : 'Set FTP for watts'}
    </Link>
  );

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--text-secondary)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1880px] items-center justify-between gap-4 px-5 sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <h1 className="text-base font-medium tracking-[-0.01em] text-[var(--text)]">Ride</h1>
            <span className="data hidden truncate text-[13px] text-[var(--text-muted)] sm:inline">{format(fromDayKey(hub.today), 'EEEE d MMMM')}</span>
          </div>
          <Menu>
            <MenuTrigger aria-label="More ride options" className={iconButtonClassName}>
              <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem render={<Link href="/athlete/calendar" />}>
                <CalendarDays aria-hidden="true" size={16} strokeWidth={1.6} />
                Calendar
              </MenuItem>
              <MenuItem render={<Link href="/athlete" />}>
                <House aria-hidden="true" size={16} strokeWidth={1.6} />
                Home
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>

      <main id="ride-hub" className="mx-auto max-w-[1140px] space-y-6 px-5 py-6 sm:px-7 lg:space-y-8 lg:px-10 lg:py-8">
        <UnsavedRidesNotice userId={user.id} />

        <section aria-labelledby="ride-today" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ride-today" className={sectionHeadingClassName}>Today</h2>
            {firstToday ? ftpLink : null}
          </div>
          {firstToday ? (
            <>
              <TodayFeature session={firstToday} />
              {laterToday.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {laterToday.map((session) => <SessionLine key={session.id} session={session} />)}
                </div>
              ) : null}
            </>
          ) : (
            <div className="tile-empty rounded-2xl px-5 py-6">
              <p className="text-base font-medium text-[var(--text)]">Nothing planned for today</p>
              <Link href={libraryHref} className={`${secondaryButtonClassName} mt-3 max-md:min-h-11`}>
                Browse bike workouts
                <ArrowRight aria-hidden="true" size={16} strokeWidth={1.6} />
              </Link>
            </div>
          )}
        </section>

        <Disclosure summary={<span>Earlier rides{earlierCount > 0 ? ` (${earlierCount})` : ''}</span>}>
          {hub.overdueSessions.length > 0 ? (
            <section aria-labelledby="ride-overdue" className="space-y-2">
              <h3 id="ride-overdue" className={sectionHeadingClassName}>Still open</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {hub.overdueSessions.map((session) => <SessionLine key={session.id} session={session} />)}
              </div>
            </section>
          ) : null}
          <section aria-labelledby="ride-recent" className="space-y-2">
            <h3 id="ride-recent" className={sectionHeadingClassName}>Recent rides</h3>
            {hub.recent.length > 0 ? (
              <ul className="divide-y divide-[var(--border)]">
                {hub.recent.map((ride) => <RecentLine key={ride.sessionId} ride={ride} />)}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--text-muted)]">Finished rides appear here with their time and load.</p>
            )}
          </section>
        </Disclosure>

        <section aria-labelledby="ride-library" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ride-library" className={sectionHeadingClassName}>From the bike workout library</h2>
            {firstToday ? (
              <Link href={libraryHref} className={`${ghostButtonClassName('compact')} max-md:min-h-11`}>
                Browse bike workouts
                <ArrowRight aria-hidden="true" size={16} strokeWidth={1.6} />
              </Link>
            ) : ftpLink}
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {catalogPreview.map((entry) => (
              <li key={entry.workout.slug} className="min-w-0">
                <LibraryCard entry={entry} from="ride" />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function sessionMeta(session: RideHubSession) {
  return [session.overdue ? format(parseISO(session.day), 'EEE d MMM') : session.timeLabel, formatDuration(session.durationSec), `${session.tss} TSS`].filter(Boolean).join(' · ');
}

function TodayFeature({ session }: { session: RideHubSession }) {
  return (
    <article className="tile flex flex-col gap-4 rounded-2xl p-5">
      <div className="min-w-0">
        <h3 className="text-[19px] font-medium leading-snug tracking-[-0.01em] text-[var(--text)]">{session.title}</h3>
        <p className="data mt-1 text-[13px] text-[var(--text-muted)]">{sessionMeta(session)}</p>
      </div>
      <SessionBlockBar segments={session.segments} size="card" />
      <div className="flex flex-wrap gap-2">
        <WorkoutStartChooser
          workout={{ title: session.title, durationSec: session.durationSec, hasSteps: session.hasSteps, sport: 'BIKING', status: 'planned' }}
          source={{ kind: 'session', id: session.id, from: 'ride' }}
          triggerClassName={`${primaryButtonClassName} max-md:flex-1 max-md:min-h-11`}
        />
        <Link href={`/athlete/session/${session.id}?from=ride`} className={`${secondaryButtonClassName} max-md:min-h-11`}>Details</Link>
      </div>
    </article>
  );
}

function SessionLine({ session }: { session: RideHubSession }) {
  return (
    <article className="flex flex-col gap-2.5 rounded-xl border border-[var(--border)] p-3">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/athlete/session/${session.id}?from=ride`} className={`group flex min-w-0 flex-1 flex-col justify-center rounded-sm max-md:min-h-11 ${buttonFocusClassName}`}>
          <span className="wrap-anywhere text-[14px] font-medium text-[var(--text)] underline-offset-4 group-hover:underline">{session.title}</span>
          <span className="data mt-0.5 text-[12px] text-[var(--text-muted)]">{sessionMeta(session)}</span>
        </Link>
        <WorkoutStartChooser
          workout={{ title: session.title, durationSec: session.durationSec, hasSteps: session.hasSteps, sport: 'BIKING', status: 'planned' }}
          source={{ kind: 'session', id: session.id, from: 'ride' }}
          triggerClassName={`${compactSecondaryButtonClassName} max-md:min-h-11`}
        />
      </div>
      <SessionBlockBar segments={session.segments} size="calendar" />
    </article>
  );
}

function RecentLine({ ride }: { ride: RideHubRecent }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <Link href={`/athlete/session/${ride.sessionId}?from=ride`} className={`group flex min-w-0 flex-1 flex-col justify-center rounded-sm max-md:min-h-11 ${buttonFocusClassName}`}>
        <span className="wrap-anywhere text-[13px] font-medium text-[var(--text)] underline-offset-4 group-hover:underline">{ride.title}</span>
        <span className="data mt-0.5 text-[12px] text-[var(--text-muted)]">
          {format(parseISO(ride.completedAt), 'EEE d MMM')} · {formatDuration(ride.durationSec)}{ride.tss !== null ? ` · ${ride.tss} TSS` : ''}
        </span>
      </Link>
      {ride.catalogSlug ? (
        <Link href={`/athlete/library/${ride.catalogSlug}?from=ride`} className={`${compactSecondaryButtonClassName} shrink-0 max-md:min-h-11`} aria-label={`Ride ${ride.title} again`}>
          <RotateCcw aria-hidden="true" size={13} strokeWidth={1.7} />Again
        </Link>
      ) : null}
    </li>
  );
}
