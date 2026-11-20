'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Download, MonitorCheck, X } from 'lucide-react';
import { ActionLink, buttonFocusClassName, compactPrimaryButtonClassName, compactSecondaryButtonClassName } from '@/components/ui';
import { detectRideOs, rideAppLink, rideDownloadBase, rideDownloads, rideInstallHints, rideSessionPath, RIDE_APP_LAUNCH_TIMEOUT_MS, type RideOs } from '@/lib/ride/launch';

const subscribeNever = () => () => undefined;
const OS_NAME: Record<RideOs, string> = { windows: 'Windows', macos: 'macOS', linux: 'Linux', other: 'your computer' };

type NavigatorWithUaData = Navigator & { userAgentData?: { platform?: string } };

function clientOs(): RideOs {
  const nav = navigator as NavigatorWithUaData;
  return detectRideOs({ platform: nav.userAgentData?.platform ?? navigator.platform, userAgent: navigator.userAgent });
}

type LaunchState = 'idle' | 'launching' | 'failed';

/** "Ride with trainer", plus a deep link into the Tempo Ride desktop app with an install fallback. */
export function RideEntryLinks({ sessionId, from }: { sessionId: number; from?: string }) {
  const origin = useSyncExternalStore(subscribeNever, () => window.location.origin, () => '');
  const isDesktop = useSyncExternalStore(subscribeNever, () => Boolean(window.tempoDesktop?.isDesktop), () => false);
  const os = useSyncExternalStore(subscribeNever, clientOs, () => 'other' as RideOs);
  const [launch, setLaunch] = useState<LaunchState>('idle');
  const cleanupRef = useRef<(() => void) | null>(null);
  const panelId = useId();
  const ridePath = rideSessionPath(sessionId, from);

  useEffect(() => () => cleanupRef.current?.(), []);

  // A registered handler takes focus or hides the page; if neither happens, assume the app is missing.
  const openApp = useCallback(() => {
    cleanupRef.current?.();
    setLaunch('launching');
    let settled = false;
    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      setLaunch('idle');
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') succeed(); };
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      setLaunch('failed');
    }, RIDE_APP_LAUNCH_TIMEOUT_MS);
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener('blur', succeed);
      window.removeEventListener('pagehide', succeed);
      document.removeEventListener('visibilitychange', onVisibility);
      cleanupRef.current = null;
    }
    window.addEventListener('blur', succeed);
    window.addEventListener('pagehide', succeed);
    document.addEventListener('visibilitychange', onVisibility);
    cleanupRef.current = cleanup;
    window.location.href = rideAppLink(new URL(ridePath, origin).href);
  }, [origin, ridePath]);

  if (isDesktop) {
    return (
      <>
        <ActionLink href={ridePath} tone="secondary">Ride with trainer</ActionLink>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          <MonitorCheck aria-hidden="true" size={14} strokeWidth={1.6} className="text-[var(--status-success)]" />
          Running in Tempo Ride
        </span>
      </>
    );
  }

  const downloads = rideDownloads(os, rideDownloadBase(process.env.NEXT_PUBLIC_TEMPO_RIDE_DOWNLOAD_URL));
  const primary = os === 'other' ? [] : downloads.filter((download) => download.os === os);
  const others = downloads.filter((download) => !primary.includes(download));

  return (
    <>
      <ActionLink href={ridePath} tone="secondary">Ride with trainer</ActionLink>
      {origin ? (
        <span className="relative inline-flex">
        <button
          type="button"
          onClick={openApp}
          disabled={launch === 'launching'}
          aria-expanded={launch === 'failed'}
          aria-controls={panelId}
          className={`rounded text-[13px] font-medium text-[var(--brand)] underline-offset-4 hover:underline disabled:opacity-60 ${buttonFocusClassName}`}
        >
          {launch === 'launching' ? 'Opening Tempo Ride…' : 'Open in Tempo Ride app'}
        </button>
      {launch === 'failed' ? (
        <section
          id={panelId}
          aria-labelledby={`${panelId}-title`}
          role="region"
          onKeyDown={(event) => { if (event.key === 'Escape') setLaunch('idle'); }}
          className="absolute right-0 top-full z-40 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-xl max-sm:fixed max-sm:inset-x-4 max-sm:bottom-20 max-sm:top-auto max-sm:z-50 max-sm:mt-0 max-sm:max-h-[calc(100dvh-7rem)] max-sm:w-auto max-sm:overflow-y-auto border border-[var(--border-strong)] bg-[var(--raised)] p-4 text-left shadow-[var(--shadow-overlay)] sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id={`${panelId}-title`} className="text-[15px] font-medium text-[var(--text)]">Tempo Ride didn&apos;t open</h3>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                {os === 'other' ? 'The desktop app runs on Windows, macOS and Linux.' : `Install the desktop app for ${OS_NAME[os]} to ride with a Bluetooth trainer outside the browser.`}
              </p>
            </div>
            <button type="button" className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-[var(--text)] ${buttonFocusClassName}`} aria-label="Close install help" onClick={() => setLaunch('idle')}>
              <X aria-hidden="true" size={16} strokeWidth={1.6} />
            </button>
          </div>
          {primary.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {primary.map((download, index) => (
                <a key={download.id} href={download.url} className={`${index === 0 ? compactPrimaryButtonClassName : compactSecondaryButtonClassName} gap-1.5`}>
                  <Download aria-hidden="true" size={14} strokeWidth={1.7} />{download.label}
                </a>
              ))}
            </div>
          ) : null}
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-[var(--text-secondary)] marker:text-[var(--text-muted)]">
            {rideInstallHints(os).map((hint) => <li key={hint}>{hint}</li>)}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-4">
            <button type="button" className={compactSecondaryButtonClassName} onClick={openApp}>I&apos;ve installed it — open now</button>
            <details className="text-[13px] text-[var(--text-secondary)]">
              <summary className={`cursor-pointer rounded hover:text-[var(--text)] ${buttonFocusClassName}`}>{primary.length ? 'Other systems' : 'Downloads'}</summary>
              <ul className="mt-2 space-y-1">
                {others.map((download) => (
                  <li key={download.id}><a href={download.url} className="text-[var(--brand)] underline-offset-4 hover:underline">{download.label}</a></li>
                ))}
              </ul>
            </details>
          </div>
        </section>
      ) : null}
        </span>
      ) : null}
    </>
  );
}
