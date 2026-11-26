'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { useInTempoBuilderRide, useMacArchitecture, useRideOs } from '@/components/RideAppLaunch';
import { Surface, buttonFocusClassName, primaryButtonClassName, sectionHeadingClassName } from '@/components/ui';
import { RIDE_DESKTOP_VERSION, configuredRideDownloadBase, rideDownloadChoices, rideInstallHints, type RideDownload, type RideOs } from '@/lib/ride/launch';

const osNames: Record<Exclude<RideOs, 'other'>, string> = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
const desktopSystems = Object.keys(osNames) as Array<Exclude<RideOs, 'other'>>;
const linkClassName = 'text-[var(--brand)] underline-offset-4 hover:underline';

function HintList({ os }: { os: RideOs }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-[1.55] text-[var(--text-secondary)]">
      {rideInstallHints(os).map((hint) => <li key={hint}>{hint}</li>)}
    </ul>
  );
}

export function RideDownloadPage() {
  const os = useRideOs();
  const inTempoBuilderRide = useInTempoBuilderRide();
  const architecture = useMacArchitecture(os);
  const { recommended, others } = rideDownloadChoices(os ?? 'other', configuredRideDownloadBase(), architecture);
  const detected = os && os !== 'other' ? os : null;
  const otherSystems = desktopSystems.filter((system) => system !== detected);

  return (
    <div className="space-y-5">
      {inTempoBuilderRide ? (
        <p role="status" className="rounded-2xl border border-[var(--border)] px-5 py-4 text-sm text-[var(--text-secondary)]">
          You are already using TempoBuilder Ride on this computer. The installers below are for your other computers.
        </p>
      ) : null}
      <Surface>
        {detected ? (
          <div className="space-y-4">
            <h2 className={sectionHeadingClassName}>For your {osNames[detected]} computer</h2>
            <div className="flex flex-wrap gap-2">
              {recommended.map((download) => (
                <a key={download.id} href={download.url} className={primaryButtonClassName}>
                  <Download aria-hidden="true" size={16} strokeWidth={1.8} />{download.label}
                </a>
              ))}
            </div>
            {detected === 'macos' && !architecture ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Not sure which Mac you have? Open the Apple menu and choose About This Mac. “Chip: Apple M…” means Apple silicon; “Processor: Intel” means Intel.
              </p>
            ) : null}
            <HintList os={detected} />
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className={sectionHeadingClassName}>{os === 'other' ? 'TempoBuilder Ride is for computers' : 'Choose your system'}</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {os === 'other'
                ? 'Open this page on a Windows, macOS or Linux computer. On this device, start a workout in your browser instead. Chrome on Android can connect to Bluetooth trainers.'
                : 'Pick the installer for your computer below.'}
            </p>
          </div>
        )}
      </Surface>

      <Surface>
        <h2 className={sectionHeadingClassName}>{detected ? 'Other systems' : 'All installers'}</h2>
        <div className="mt-4 divide-y divide-[var(--border)]">
          {otherSystems.map((system) => (
            <SystemDownloads
              key={system}
              name={osNames[system]}
              downloads={others.filter((download) => download.os === system)}
              os={system}
            />
          ))}
          {detected && others.some((download) => download.os === detected) ? (
            <SystemDownloads
              name={`${osNames[detected]} (other chip)`}
              downloads={others.filter((download) => download.os === detected)}
            />
          ) : null}
        </div>
      </Surface>

      <p className="text-sm text-[var(--text-muted)]">
        Version {RIDE_DESKTOP_VERSION}. The installers aren’t signed yet, so your computer may ask you to confirm the first time you open the app. After installing, open a bike workout in TempoBuilder and choose <strong className="font-medium text-[var(--text-secondary)]">Start workout → Open in TempoBuilder Ride</strong>. <Link href="/" className={linkClassName}>Back to TempoBuilder</Link>
      </p>
    </div>
  );
}

function SystemDownloads({ name, downloads, os }: { name: string; downloads: RideDownload[]; os?: RideOs }) {
  return (
    <div className="space-y-2 py-4 first:pt-0 last:pb-0">
      <p className="text-[13.5px] font-semibold text-[var(--text)]">{name}</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {downloads.map((download) => (
          <li key={download.id}><a href={download.url} className={linkClassName}>{download.label}</a></li>
        ))}
      </ul>
      {os ? (
        <details className="text-sm">
          <summary className={`cursor-pointer rounded text-[var(--text-secondary)] hover:text-[var(--text)] ${buttonFocusClassName}`}>Install steps</summary>
          <div className="mt-2"><HintList os={os} /></div>
        </details>
      ) : null}
    </div>
  );
}
