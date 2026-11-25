import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { WorkoutProfileExplorer } from '@/components/WorkoutProfile';
import { Badge, PageShell, StatTile, Surface, TopBar, buttonFocusClassName, sectionHeadingClassName } from '@/components/ui';
import type { BackTarget } from '@/lib/app-navigation';
import { formatMeters } from '@/lib/format-distance';
import { formatDuration, formatDurationExact } from '@/lib/format-duration';
import { getTempoZoneMeta } from '@/lib/tempo-blocks';
import type { WorkoutProfileModel } from '@/lib/workout-profile';

/** One row of the block list: a single block, drawn with its colour, duration and target. */
export type WorkoutDetailBlock = { label: string; note: string | null; durationSec: number; /** Swim distance; the duration is then an estimate. */ distanceM?: number | null; target: string | null; unit: string | null; color: string };
/** A single block, or a repeat of blocks done `repeat` times in a row. */
export type WorkoutDetailItem = { repeat: number | null; blocks: WorkoutDetailBlock[] };

/**
 * The one workout detail layout, for public library workouts and your saved
 * workouts alike: header, badges and actions, intensity profile, notes, the block
 * list and a details disclosure. Callers only map their data into it.
 */
export function WorkoutDetail({
  back, title, description, badges, durationSec, actions,
  profile, profileNote, profileLabel, ftpWatts,
  about, items, itemsSummary, stats, zoneSec, tags, usedIn,
}: {
  back: BackTarget;
  title: string;
  description?: string | null;
  badges: { label: string; tone?: 'brand' }[];
  durationSec: number;
  actions: ReactNode;
  profile: WorkoutProfileModel;
  profileNote: ReactNode;
  profileLabel: string;
  ftpWatts: number | null;
  about: { heading: string; paragraphs: string[] } | null;
  items: WorkoutDetailItem[];
  itemsSummary: string;
  stats: { label: string; value: string; unit?: string }[];
  zoneSec: readonly number[];
  tags?: { label: string; href: string }[];
  /** Built-in training plans that offer this workout. */
  usedIn?: { label: string; href: string }[];
}) {
  return (
    <PageShell size="wide">
      <TopBar back={back} title={title} description={description ?? undefined} />

      <div className="-mt-2 flex flex-wrap items-center gap-2">
        {badges.map((badge) => <Badge key={badge.label} tone={badge.tone}>{badge.label}</Badge>)}
        <span className="data text-[13px] text-[var(--text-secondary)]">{formatDuration(durationSec)}</span>
      </div>

      {actions}

      {profile.steps.length ? (
        <Surface className="[--profile-gap:var(--surface)] pb-4">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className={sectionHeadingClassName}>Intensity</h2>
            <p className="text-[12px] text-[var(--text-muted)]">{profileNote}</p>
          </div>
          <WorkoutProfileExplorer model={profile} ftpWatts={ftpWatts} label={profileLabel} />
        </Surface>
      ) : null}

      {about && about.paragraphs.length ? (
        <section aria-labelledby="workout-about" className="min-w-0">
          <h2 id="workout-about" className={sectionHeadingClassName}>{about.heading}</h2>
          <div className="mt-3 max-w-[68ch] space-y-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
            {about.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="workout-blocks" className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="workout-blocks" className={sectionHeadingClassName}>Blocks</h2>
          <p className="data text-[12px] text-[var(--text-muted)]">{itemsSummary}</p>
        </div>
        <ol className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {items.map((item, itemIndex) => item.repeat ? (
            <li key={itemIndex} className="py-2">
              <p className="data py-1.5 text-[13px] font-medium text-[var(--text)]">{item.repeat} ×<span className="ml-2 font-normal text-[var(--text-muted)]">{repeatTotal(item.repeat, item.blocks)}</span></p>
              <ol className="ml-3 border-l border-[var(--border-strong)] pl-3">
                {item.blocks.map((block, blockIndex) => <BlockRow key={blockIndex} block={block} />)}
              </ol>
            </li>
          ) : item.blocks.map((block, blockIndex) => <BlockRow key={`${itemIndex}-${blockIndex}`} block={block} />))}
        </ol>
        {usedIn?.length ? (
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-muted)]">
            Used in plans:{' '}
            {usedIn.map((plan, index) => (
              <Fragment key={plan.label}>
                {index ? ', ' : null}
                <Link href={plan.href} className="rounded-sm text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--brand)]">{plan.label}</Link>
              </Fragment>
            ))}
          </p>
        ) : null}
      </section>

      <details className="group border-y border-[var(--border)]">
        <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--raised)] [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
          Workout details
          <ChevronDown aria-hidden="true" size={16} className="text-[var(--text-muted)] transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-6 pb-5 pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((stat) => <StatTile key={stat.label} label={stat.label} value={stat.value} unit={stat.unit} />)}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="workout-zones" className="min-w-0">
              <h2 id="workout-zones" className={sectionHeadingClassName}>Time in zone</h2>
              <ul className="mt-3 space-y-2.5">
                {zoneSec.map((seconds, index) => {
                  const zone = getTempoZoneMeta(index + 1);
                  const share = durationSec ? seconds / durationSec : 0;
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
            {tags?.length ? (
              <section aria-labelledby="workout-tags" className="min-w-0">
                <h2 id="workout-tags" className={sectionHeadingClassName}>Tags</h2>
                <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
                  {tags.map((tag) => (
                    <li key={tag.label}><Link href={tag.href} className="rounded-full text-[13px] text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--brand)]">#{tag.label}</Link></li>
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

/** "Watts based on your FTP of 250 W", or how to get watts when no FTP is set. */
export function FtpProfileNote({ ftpWatts }: { ftpWatts: number | null }) {
  return ftpWatts
    ? <>Watts based on your FTP of <span className="data text-[var(--text-secondary)]">{ftpWatts}&nbsp;W</span></>
    : <>Targets in % of FTP. <Link href="/athlete/profile" className="text-[var(--brand)] underline-offset-4 hover:underline">Add your FTP</Link> to see watts.</>;
}

/** "50m", or for swim sets the distance first: "2,000 m, est. 50m". */
function repeatTotal(repeat: number, blocks: WorkoutDetailBlock[]) {
  const duration = formatDuration(blocks.reduce((sum, block) => sum + block.durationSec, 0) * repeat);
  const meters = blocks.reduce((sum, block) => sum + (block.distanceM ?? 0), 0) * repeat;
  return meters ? `${formatMeters(meters)}, est.\u00A0${duration}` : duration;
}

function BlockRow({ block }: { block: WorkoutDetailBlock }) {
  return (
    <li className="flex gap-3 py-2.5 text-[13px]">
      <span aria-hidden="true" className="mt-1 h-3.5 w-1.5 shrink-0 rounded-full" style={{ background: block.color }} />
      <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
        <div className="flex items-baseline justify-between gap-3 sm:contents">
          <span className="font-medium text-[var(--text)] sm:w-24 sm:shrink-0">{block.label}</span>
          <span className="data whitespace-nowrap text-right text-[var(--text)] sm:order-4 sm:w-36 sm:shrink-0">{block.target ?? '—'}{block.unit ? <span className="ml-1 text-[11px] text-[var(--text-muted)]">{block.unit}</span> : null}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:contents">
          <span className="min-w-0 text-[var(--text-muted)] sm:order-2 sm:flex-1">{block.note}</span>
          <span className="data whitespace-nowrap text-right text-[var(--text-secondary)] sm:order-3 sm:w-36 sm:shrink-0">{block.distanceM ? <>{formatMeters(block.distanceM)}<span className="ml-2 text-[var(--text-muted)]">est. {formatDurationExact(block.durationSec)}</span></> : formatDurationExact(block.durationSec)}</span>
        </div>
      </div>
    </li>
  );
}
