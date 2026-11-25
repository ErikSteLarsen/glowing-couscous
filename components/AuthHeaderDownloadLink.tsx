'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { useInTempoRide } from '@/components/RideAppLaunch';
import { ghostButtonClassName } from '@/components/ui';

/** Points signed-out visitors at the desktop app; hidden inside Wattonaut Ride itself. */
export function AuthHeaderDownloadLink() {
  const inTempoRide = useInTempoRide();
  if (inTempoRide) return null;
  return (
    <Link href="/download" className={ghostButtonClassName('compact')}>
      <Download aria-hidden="true" size={14} strokeWidth={1.7} />Desktop app
    </Link>
  );
}
