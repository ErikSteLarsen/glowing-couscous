'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ComponentProps } from 'react';

import { withCalendarReturn } from '@/lib/calendar-navigation';

/** A link into a Calendar add dialog; cancelling the dialog comes back to this page, filters included. */
export function ReturnHereLink({ href, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return <Link {...props} href={withCalendarReturn(href, query ? `${pathname}?${query}` : pathname)} />;
}
