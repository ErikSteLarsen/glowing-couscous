import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CatalogProfile, pctColor } from '@/components/library/CatalogProfile';
import { LibraryWorkoutActions } from '@/components/library/LibraryWorkoutActions';
import { ChevronDown } from 'lucide-react';
import { Badge, PageShell, StatTile, Surface, TopBar, buttonFocusClassName, sectionHeadingClassName } from '@/components/ui';
import { publicLibraryHref } from '@/lib/athlete-workouts-navigation';
import { accountService } from '@/lib/account-service';
import { parseBackOrigin, resolveBackTarget } from '@/lib/app-navigation';
import { getCurrentUser } from '@/lib/auth-session';
import { formatDuration, formatDurationExact } from '@/lib/format-duration';
import { getTempoZoneMeta } from '@/lib/tempo-blocks';
import { workoutCatalog } from '@/lib/workout-catalog';
import { catalogWorkoutMetrics, expandCatalogItems, isCatalogRepeat, wattsForPct } from '@/lib/workout-catalog/metrics';
import { categoryLabel, EMPTY_CATALOG_QUERY, findCatalogWorkout, levelLabel } from '@/lib/workout-catalog/query';
import type { CatalogStep } from '@/lib/workout-catalog/types';

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const workout = findCatalogWorkout(workoutCatalog, (await params).slug);
  return { title: workout ? workout.name : 'Public library' };
}

const KIND_LABEL: Record<CatalogStep['kind'], string> = { warmup: 'Warm-up', work: 'Effort', recovery: 'Recovery', cooldown: 'Cool-down' };

export default async function LibraryWorkoutPage({ params, searchParams }: Params) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const [{ slug }, { from }] = await Promise.all([params, searchParams]);
  const workout = findCatalogWorkout(workoutCatalog, slug);
  if (!workout) notFound();

  const account = await accountService.getAccount(user.id);
  const ftp = account?.performanceProfile.cycling.ftpWatts ?? null;
  const metrics = catalogWorkoutMetrics(workout);
  const steps = expandCatalogItems(workout.items);
  const origin = parseBackOrigin('library-workout', from) ?? 'library';
  const back = resolveBackTarget({ route: 'library-workout', from });
  const paragraphs = workout.description.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const pct = (value: number) => ftp ? `${wattsForPct(value, ftp)}` : `${Math.round(value)}`;
  const pctUnit = ftp ? 'W' : '% FTP';

  return (
    <PageShell size="wide">
      <TopBar back={back} title={workout.name} description={workout.summary} />

      <div className="-mt-2 flex flex-wrap items-center gap-2">
        <Badge tone="brand">{categoryLabel(workout.category)}</Badge>
        <Badge>{levelLabel(workout.level)}</Badge>
        <span className="data text-[13px] text-[var(--text-secondary)]">{formatDuration(metrics.durationSec)}</span>
      </div>

      <LibraryWorkoutActions slug={workout.slug} name={workout.name} durationSec={metrics.durationSec} hasSteps={steps.length > 0} from={origin} />

      <Surface className="[--profile-gap:var(--surface)] pb-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={sectionHeadingClassName}>Profile</h2>
          <p className="text-[12px] text-[var(--text-muted)]">
            {ftp ? <>Watts from your FTP of <span className="data text-[var(--text-secondary)]">{ftp}&nbsp;W</span></> : <>Targets in % of FTP. <Link href="/athlete/profile" className="text-[var(--brand)] underline-offset-4 hover:underline">Add your FTP</Link> to see watts.</>}
          </p>
        </div>
        <CatalogProfile
          steps={steps}
          idPrefix={`detail-${workout.slug}`}
          variant="full"
          ftpWatts={ftp}
          label={`${workout.name} intensity profile: ${formatDuration(metrics.durationSec)}, ${steps.length} steps, peak ${Math.round(metrics.maxPct)}% of FTP. The interval list below gives every step.`}
        />
      </Surface>

      <section aria-labelledby="library-about" className="min-w-0">
        <h2 id="library-about" className={sectionHeadingClassName}>How to ride it</h2>
        <div className="mt-3 max-w-[68ch] space-y-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
          {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </section>

      <section aria-labelledby="library-intervals" className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="library-intervals" className={sectionHeadingClassName}>Intervals</h2>
          <p className="data text-[12px] text-[var(--text-muted)]">{metrics.intervalCount}&nbsp;efforts&nbsp;· {formatDuration(metrics.workSec)}&nbsp;of work</p>
        </div>
        <ol className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {workout.items.map((item, itemIndex) => isCatalogRepeat(item) ? (
            <li key={itemIndex} className="py-2">
              <p className="data py-1.5 text-[13px] font-medium text-[var(--text)]">{item.repeat} ×<span className="ml-2 font-normal text-[var(--text-muted)]">{formatDuration(item.steps.reduce((sum, step) => sum + step.durationSec, 0) * item.repeat)}</span></p>
              <ol className="ml-3 border-l border-[var(--border-strong)] pl-3">
                {item.steps.map((step, stepIndex) => <StepRow key={stepIndex} step={step} format={pct} unit={pctUnit} />)}
              </ol>
            </li>
          ) : (
            <StepRow key={itemIndex} step={item} format={pct} unit={pctUnit} />
          ))}
        </ol>
      </section>

      <details className="group border-y border-[var(--border)]">
        <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
          Workout details
          <ChevronDown aria-hidden="true" size={16} className="text-[var(--text-muted)] transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-6 pb-5 pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Duration" value={formatDuration(metrics.durationSec)} />
            <StatTile label="Training load" value={String(metrics.tss)} unit="TSS" />
            <StatTile label="Intensity factor" value={metrics.intensityFactor.toFixed(2)} unit="IF" />
            <StatTile label="Normalized power, est." value={pct(metrics.npPct)} unit={pctUnit} />
            <StatTile label="Peak target" value={pct(metrics.maxPct)} unit={pctUnit} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="library-zones" className="min-w-0">
              <h2 id="library-zones" className={sectionHeadingClassName}>Time in zone</h2>
              <ul className="mt-3 space-y-2.5">
                {metrics.zoneSec.map((seconds, index) => {
                  const zone = getTempoZoneMeta(index + 1);
                  const share = metrics.durationSec ? seconds / metrics.durationSec : 0;
                  return (
                    <li key={zone.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 text-[13px]">
                      <span className="text-[var(--text-secondary)]"><span className="data text-[var(--text)]">{zone.label}</span> {zone.name}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-[var(--raised)]" aria-hidden="true">
                        <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, backgroundColor: `var(--color-zone-${index + 1})` }} />
                      </span>
                      <span className="data text-right text-[var(--text-secondary)]">{seconds ? formatDuration(seconds) : '—'}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
            {workout.tags.length ? (
              <section aria-labelledby="library-tags" className="min-w-0">
                <h2 id="library-tags" className={sectionHeadingClassName}>Tags</h2>
                <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
                  {workout.tags.map((tag) => (
                    <li key={tag}><Link href={publicLibraryHref({ ...EMPTY_CATALOG_QUERY, tags: [tag] })} className="rounded-full text-[13px] text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">#{tag}</Link></li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </details>
    </PageShell>
  );
}

function StepRow({ step, format, unit }: { step: CatalogStep; format: (pct: number) => string; unit: string }) {
  const ranged = step.lowPct !== step.highPct;
  const ramp = ranged && (step.kind === 'warmup' || step.kind === 'cooldown');
  const [from, to] = step.kind === 'cooldown' ? [step.highPct, step.lowPct] : [step.lowPct, step.highPct];
  const target = ramp ? `${format(from)} → ${format(to)}` : ranged ? `${format(step.lowPct)}–${format(step.highPct)}` : format(step.lowPct);
  const cue = [step.cue, step.cadence ? `${step.cadence[0]}–${step.cadence[1]}\u00A0rpm` : null].filter(Boolean).join('\u00A0· ');
  return (
    <li className="flex gap-3 py-2.5 text-[13px]">
      <span aria-hidden="true" className="mt-1 h-3.5 w-1.5 shrink-0 rounded-full" style={{ background: pctColor((step.lowPct + step.highPct) / 2) }} />
      <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
        <div className="flex items-baseline justify-between gap-3 sm:contents">
          <span className="font-medium text-[var(--text)] sm:w-24 sm:shrink-0">{KIND_LABEL[step.kind]}</span>
          <span className="data whitespace-nowrap text-right text-[var(--text)] sm:order-4 sm:w-36 sm:shrink-0">{target}<span className="ml-1 text-[11px] text-[var(--text-muted)]">{unit}</span></span>
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:contents">
          <span className="min-w-0 text-[var(--text-muted)] sm:order-2 sm:flex-1">{cue}</span>
          <span className="data whitespace-nowrap text-right text-[var(--text-secondary)] sm:order-3 sm:w-24 sm:shrink-0">{formatDurationExact(step.durationSec)}</span>
        </div>
      </div>
    </li>
  );
}
