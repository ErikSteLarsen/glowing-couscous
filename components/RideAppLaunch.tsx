'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { buttonFocusClassName, compactSecondaryButtonClassName } from '@/components/ui';
import { detectRideOs, macArchitectureFromHints, rideAppLink, rideDownloadBase, rideDownloadChoices, rideInstallHints, rideSessionPath, RIDE_APP_LAUNCH_TIMEOUT_MS, type MacArchitecture, type RideOs } from '@/lib/ride/launch';

type UserAgentData = {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
};

export function getRideOs(): RideOs {
  const nav: Navigator & { userAgentData?: UserAgentData } = navigator;
  return detectRideOs({
    platform: nav.userAgentData?.platform ?? nav.platform,
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
  });
}

const subscribeToNothing = () => () => undefined;

/** The visitor's OS after hydration; null during server rendering and the first client render. */
export function useRideOs(): RideOs | null {
  return useSyncExternalStore(subscribeToNothing, getRideOs, () => null);
}

/**
 * The Mac chip, where the browser reports it (Chromium's `userAgentData`).
 * Safari and Firefox return null, so Apple silicon stays first and Intel is offered beside it.
 */
export function useMacArchitecture(os: RideOs | null): MacArchitecture | null {
  const [architecture, setArchitecture] = useState<MacArchitecture | null>(null);
  useEffect(() => {
    if (os !== 'macos') return;
    const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
    if (!data?.getHighEntropyValues) return;
    let active = true;
    data.getHighEntropyValues(['architecture'])
      .then((hints) => { if (active) setArchitecture(macArchitectureFromHints(hints)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [os]);
  return os === 'macos' ? architecture : null;
}

type LaunchState = 'idle' | 'opening' | 'attempted';

export function useRideAppLaunch() {
  const [state, setState] = useState<LaunchState>('idle');
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  function launch(sessionId: number, from?: string) {
    cleanupRef.current?.();
    setState('opening');
    const onVisibility = () => { if (document.visibilityState === 'hidden') finish(); };
    const timer = window.setTimeout(finish, RIDE_APP_LAUNCH_TIMEOUT_MS);

    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener('blur', finish);
      window.removeEventListener('pagehide', finish);
      document.removeEventListener('visibilitychange', onVisibility);
      cleanupRef.current = null;
    }

    function finish() {
      cleanup();
      setState('attempted');
    }

    window.addEventListener('blur', finish);
    window.addEventListener('pagehide', finish);
    document.addEventListener('visibilitychange', onVisibility);
    cleanupRef.current = cleanup;
    try {
      window.location.href = rideAppLink(new URL(rideSessionPath(sessionId, from), window.location.origin).href);
    } catch {
      finish();
    }
  }

  function reset() {
    cleanupRef.current?.();
    setState('idle');
  }

  return { state, launch, reset };
}

export function RideAppInstallHelp({ os, onRetry }: { os: RideOs; onRetry: () => void }) {
  const architecture = useMacArchitecture(os);
  const { recommended: primary, others } = rideDownloadChoices(os, rideDownloadBase(process.env.NEXT_PUBLIC_TEMPO_RIDE_DOWNLOAD_URL), architecture);

  return (
    <div className="space-y-3 border-t border-[var(--border)] pt-4 text-sm text-[var(--text-secondary)]">
      <p role="status" className="font-medium text-[var(--text)]">Tempo Ride may not have opened</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={compactSecondaryButtonClassName} onClick={onRetry}>Try opening Tempo Ride again</button>
        {primary.map((download) => (
          <a key={download.id} href={download.url} className={compactSecondaryButtonClassName}>
            <Download aria-hidden="true" size={14} strokeWidth={1.7} />{download.label}
          </a>
        ))}
      </div>
      <details>
        <summary className={`cursor-pointer rounded hover:text-[var(--text)] ${buttonFocusClassName}`}>Install help and other systems</summary>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          {rideInstallHints(os).map((hint) => <li key={hint}>{hint}</li>)}
        </ul>
        <ul className="mt-2 space-y-1">
          {others.map((download) => (
            <li key={download.id}><a href={download.url} className="text-[var(--brand)] underline-offset-4 hover:underline">{download.label}</a></li>
          ))}
        </ul>
        <p className="mt-2"><Link href="/download" className="text-[var(--brand)] underline-offset-4 hover:underline">All downloads and install steps</Link></p>
      </details>
    </div>
  );
}
