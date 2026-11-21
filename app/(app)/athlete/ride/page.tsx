import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { loginPathFor } from '@/lib/auth-callback';
import { format, parseISO } from 'date-fns';
import { CalendarDays, House, LibraryBig, RotateCcw } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { LibraryBrowser } from '@/components/library/LibraryBrowser';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { compactSecondaryButtonClassName, ghostButtonClassName, primaryButtonClassName, secondaryButtonClassName, sectionHeadingClassName } from '@/components/ui';
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

const navLinkClassName = `${ghostButtonClassName('compact')} !text-[var(--text-secondary)] hover:!text-[var(--text)] max-md:min-h-10`;

/** Ride home: what to ride today, recent rides, and the built-in library. Tempo Ride opens here. */
export default async function RideHubPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect(loginPathFor('/athlete/ride'));

  const [hub, account, params] = await Promise.all([getRequestTimeZone().then((timeZone) => rideHubService.load(user.id, { timeZone })), accountService.getAccount(user.id), searchParams]);
  const ftp = account?.performanceProfile.cycling.ftpWatts ?? null;
  const [firstToday, ...laterToday] = hub.todaySessions;

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--text-secondary)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1880px] items-center justify-between gap-4 px-5 sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <h1 className="text-base font-medium tracking-[-0.01em] text-[var(--text)]">Ride</h1>
            <span className="data hidden truncate text-[13px] text-[var(--text-muted)] sm:inline">{format(fromDayKey(hub.today), 'EEEE d MMMM')}</span>
          </div>
          <nav aria-label="Leave ride" className="flex items-center gap-1">
            {ftp ? (
              <Link href="/athlete/profile" className={`${navLinkClassName} data mr-1 hidden sm:inline-flex`} title="Functional threshold power from your profile">
                FTP <span className="text-[var(--text)]">{ftp}</span><span className="text-[var(--text-muted)]">W</span>
              </Link>
            ) : (
              <Link href="/athlete/profile" className={`${ghostButtonClassName('compact')} mr-1 hidden sm:inline-flex`}>Set FTP for watts</Link>
            )}
            <Link href="/athlete/calendar" className={navLinkClassName} aria-label="Calendar"><CalendarDays aria-hidden="true" size={16} strokeWidth={1.6} /><span className="max-md:sr-only">Calendar</span></Link>
            <Link href="/athlete" className={navLinkClassName} aria-label="Home"><House aria-hidden="true" size={16} strokeWidth={1.6} /><span className="max-md:sr-only">Home</span></Link>
          </nav>
        </div>
      </header>

      <main id="ride-hub" className="mx-auto grid max-w-[1880px] gap-10 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] lg:gap-12 lg:px-10 lg:py-8 2xl:grid-cols-[26rem_minmax(0,1fr)]">
        <aside className="flex min-w-0 flex-col gap-8 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <UnsavedRidesNotice userId={user.id} />
          <section aria-labelledby="ride-today" className="flex flex-col gap-3">
            <h2 id="ride-today" className={sectionHeadingClassName}>Today</h2>
            {firstToday ? (
              <>
                <TodayFeature session={firstToday} />
                {laterToday.map((session) => <SessionLine key={session.id} session={session} />)}
              </>
            ) : (
              <div className="tile-empty rounded-2xl px-5 py-6">
                <p className="text-base font-medium text-[var(--text)]">Nothing planned for today</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-muted)]">Pick a workout from the library and ride it now, or plan your week in Calendar.</p>
              </div>
            )}
          </section>

          {hub.overdueSessions.length ? (
            <section aria-labelledby="ride-overdue" className="flex flex-col gap-2">
              <h2 id="ride-overdue" className={sectionHeadingClassName}>Not ridden yet</h2>
              <p className="-mt-1 text-[12px] text-[var(--text-muted)]">Planned in the last two weeks and still open.</p>
              {hub.overdueSessions.map((session) => <SessionLine key={session.id} session={session} />)}
            </section>
          ) : null}

          <section aria-labelledby="ride-recent" className="flex flex-col gap-1">
            <h2 id="ride-recent" className={`${sectionHeadingClassName} mb-2`}>Recent rides</h2>
            {hub.recent.length ? (
              <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {hub.recent.map((ride) => <RecentLine key={ride.sessionId} ride={ride} />)}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--text-muted)]">Finished rides appear here with their time and load.</p>
            )}
          </section>
        </aside>

        <section aria-labelledby="ride-library" className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="ride-library" className="text-[22px] font-medium tracking-[-0.02em] text-[var(--text)]">Workout library</h2>
              <p className="mt-1 text-[13px] text-[var(--text-muted)]">Start a library workout to add it to today.</p>
            </div>
            <Link href="/athlete/library" className={navLinkClassName}><LibraryBig aria-hidden="true" size={16} strokeWidth={1.6} />Open full library</Link>
          </div>
          <LibraryBrowser entries={createCatalogListEntries(workoutCatalog)} initialQuery={parseCatalogQuery(params)} variant="hub" />
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
          triggerClassName={`${primaryButtonClassName} flex-1 max-md:min-h-11`}
        />
        <Link href={`/athlete/session/${session.id}?from=ride`} className={secondaryButtonClassName}>Details</Link>
      </div>
    </article>
  );
}

function SessionLine({ session }: { session: RideHubSession }) {
  return (
    <article className="flex flex-col gap-2.5 rounded-xl border border-[var(--border)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-medium text-[var(--text)]">
            <Link href={`/athlete/session/${session.id}?from=ride`} className="rounded-sm hover:underline hover:underline-offset-4">{session.title}</Link>
          </h3>
          <p className="data mt-0.5 text-[12px] text-[var(--text-muted)]">{sessionMeta(session)}</p>
        </div>
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
      <div className="min-w-0">
        <Link href={`/athlete/session/${ride.sessionId}?from=ride`} className="block truncate rounded-sm text-[13px] font-medium text-[var(--text)] hover:underline hover:underline-offset-4">{ride.title}</Link>
        <p className="data mt-0.5 text-[12px] text-[var(--text-muted)]">
          {format(parseISO(ride.completedAt), 'EEE d MMM')} · {formatDuration(ride.durationSec)}{ride.tss !== null ? ` · ${ride.tss} TSS` : ''}
        </p>
      </div>
      {ride.catalogSlug ? (
        <Link href={`/athlete/library/${ride.catalogSlug}?from=ride`} className={`${compactSecondaryButtonClassName} shrink-0`} aria-label={`Ride ${ride.title} again`}>
          <RotateCcw aria-hidden="true" size={13} strokeWidth={1.7} />Again
        </Link>
      ) : null}
    </li>
  );
}
