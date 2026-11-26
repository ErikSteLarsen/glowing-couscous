'use client';

import Link from 'next/link';
import { Download } from 'lucide-react';
import { useInTempoBuilderRide } from '@/components/RideAppLaunch';
import { ghostButtonClassName } from '@/components/ui';

/** Points signed-out visitors at the desktop app; hidden inside TempoBuilder Ride itself. */
export function AuthHeaderDownloadLink() {
  const inTempoBuilderRide = useInTempoBuilderRide();
  if (inTempoBuilderRide) return null;
  return (
    <Link href="/download" className={ghostButtonClassName('compact')}>
      <Download aria-hidden="true" size={14} strokeWidth={1.7} />Desktop app
    </Link>
  );
}
